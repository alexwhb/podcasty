import { env } from 'node:process'
import { data } from 'react-router'
import { Agent } from 'undici'
import { prisma } from '#app/utils/db.server.ts'

const MAX_AUDIO_BYTES =
	Number(process.env.WHISPER_MAX_AUDIO_BYTES ?? '') || 500 * 1024 * 1024 // 500MB default
const ALLOWED_AUDIO_MIME_PREFIXES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac']

// Disable the default 5 minute undici fetch timeout for long-running whisper requests.
const whisperDispatcher = new Agent({
	// Keep headers/body timeouts disabled; we already enforce a 2h abortController above.
	headersTimeout: 0,
	bodyTimeout: 0,
})

type WhisperConfig =
	| { enabled: false; reason: string }
	| { enabled: true; kind: 'openai'; apiKey: string; model: string }
	| { enabled: true; kind: 'local'; endpoint: string; model: string; authHeader?: string }

export function getWhisperConfig(): WhisperConfig {
	const apiKey = env.OPENAI_API_KEY
	const endpoint = env.WHISPER_ENDPOINT
	const enableFlag = env.ENABLE_WHISPER === 'true'
	const model = env.OPENAI_AUDIO_MODEL || 'whisper-1'

	if (endpoint) {
		return {
			enabled: true,
			kind: 'local',
			endpoint,
			authHeader: env.WHISPER_AUTH_HEADER,
			model,
		}
	}

	if (enableFlag && apiKey) {
		return {
			enabled: true,
			kind: 'openai',
			apiKey,
			model,
		}
	}

	return {
		enabled: false,
		reason:
			'Whisper not configured. Set WHISPER_ENDPOINT for local transcription, or OPENAI_API_KEY + ENABLE_WHISPER=true for OpenAI.',
	}
}

export async function transcribeEpisodeAudio({
	episodeId,
	userId,
	request,
}: {
	episodeId: string
	userId: string
	request?: Request
}) {
	const config = getWhisperConfig()
	if (!config.enabled) throw data(config.reason, { status: 400 })

	const [episode, user] = await Promise.all([
		prisma.episode.findFirst({
			where: { id: episodeId },
			select: { audioUrl: true, audioType: true, podcastId: true, podcast: { select: { ownerId: true } } },
		}),
		prisma.user.findUnique({
			where: { id: userId },
			select: { roles: { select: { name: true } } },
		}),
	])
	const isAdmin = Boolean(user?.roles.some((r) => r.name === 'admin'))
	const isOwner = episode?.podcast?.ownerId === userId
	if (!isOwner && !isAdmin) {
		throw data('Unauthorized', { status: 403 })
	}
	if (!episode || !episode.audioUrl) {
		throw data('Episode audio not found', { status: 404 })
	}

	const audioUrl =
		episode.audioUrl.startsWith('http')
			? episode.audioUrl
			: episode.audioUrl.startsWith('s3://')
				? (() => {
						try {
							const withoutScheme = episode.audioUrl.replace(/^s3:\/\//, '')
							const [bucket, ...rest] = withoutScheme.split('/')
							const key = rest.join('/')
							const endpoint = process.env.AWS_ENDPOINT_URL_S3
							if (!endpoint || !bucket || !key) return episode.audioUrl
							return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
						} catch {
							return episode.audioUrl
						}
					})()
				: new URL(
						episode.audioUrl,
						request?.url ??
							process.env.INTERNAL_APP_URL ??
							process.env.APP_URL ??
							process.env.BASE_URL ??
							`http://localhost:${process.env.PORT || 3000}`,
					).toString()

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 1000 * 60 * 120) // 2 hours
	let audioResponse: Response
	try {
		audioResponse = await fetch(audioUrl, { signal: controller.signal })
	} catch (error) {
		clearTimeout(timeout)
		throw data(
			`Unable to download audio: ${error instanceof Error ? error.message : 'unknown error'}`,
			{
				status: 502,
			},
		)
	} finally {
		clearTimeout(timeout)
	}
	if (!audioResponse.ok) {
		throw data('Unable to download audio for transcription', {
			status: 502,
		})
	}

	const contentType =
		episode.audioType ||
		audioResponse.headers.get('content-type') ||
		'audio/mpeg'
	if (!ALLOWED_AUDIO_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix))) {
		throw data('Unsupported audio format for transcription', { status: 400 })
	}

	const contentLengthHeader = audioResponse.headers.get('content-length')
	if (contentLengthHeader) {
		const contentLength = Number(contentLengthHeader)
		if (!Number.isNaN(contentLength) && contentLength > MAX_AUDIO_BYTES) {
			throw data('Audio file is too large for transcription (max 50MB)', {
				status: 400,
			})
		}
	}

	const arrayBuffer = await audioResponse.arrayBuffer()
	if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
		throw data('Audio file is too large for transcription (max 50MB)', {
			status: 400,
		})
	}

	const file = new File([arrayBuffer], 'episode-audio', {
		type: contentType,
	})

	const form = new FormData()
	const fileField = config.kind === 'openai' ? 'file' : 'audio_file'
	form.set(fileField, file)
	form.set('model', config.model)
	if (config.kind === 'local') {
		// Request SRT output from the local whisper webservice to include timestamps.
		form.set('output', 'srt')
	}

	let response: Response
	if (config.kind === 'openai') {
		const abortController = new AbortController()
		const timeout2 = setTimeout(() => abortController.abort(), 1000 * 60 * 120)
		try {
			response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: form,
				signal: abortController.signal,
			})
		} catch (error) {
			clearTimeout(timeout2)
			throw data(
				`Transcription failed: ${error instanceof Error ? error.message : 'unknown error'}`,
				{ status: 502 },
			)
		} finally {
			clearTimeout(timeout2)
		}
	} else {
		const abortController = new AbortController()
		const timeout2 = setTimeout(() => abortController.abort(), 1000 * 60 * 120)
		const headers: Record<string, string> = {}
		if (config.authHeader) {
			headers.Authorization = config.authHeader
		}
		try {
			response = await fetch(config.endpoint, {
				method: 'POST',
				headers,
				body: form,
				signal: abortController.signal,
				dispatcher: whisperDispatcher,
			})
		} catch (error) {
			clearTimeout(timeout2)
			throw data(
				`Transcription failed: ${error instanceof Error ? error.message : 'unknown error'}`,
				{ status: 502 },
			)
		} finally {
			clearTimeout(timeout2)
		}
	}

	if (!response.ok) {
		const errorText = await response.text().catch(() => 'Unknown error')
		console.error('Whisper transcription failed', {
			endpoint: config.kind === 'openai' ? 'openai' : config.endpoint,
			status: response.status,
			body: errorText,
		})
		throw data(
			`Transcription failed (${response.status}): ${errorText}`,
			{
				status: 502,
			},
		)
	}

	const responseContentType = response.headers.get('content-type')?.toLowerCase() ?? ''
	const responseText = await response.text()

	let transcriptText: string | undefined
	let segments: Array<{ start?: number; text?: string }> | undefined
	if (responseContentType.includes('application/json')) {
		try {
			const parsed = JSON.parse(responseText) as
				| { text?: string; segments?: Array<{ start?: number; end?: number; text?: string }> }
				| string
			if (typeof parsed === 'string') {
				transcriptText = parsed
			} else {
				transcriptText = parsed.text
				if (Array.isArray(parsed.segments)) {
					segments = parsed.segments
				}
			}
		} catch {
			// fall through to treat as plain text
		}
	}

	if (segments?.length) {
		transcriptText = formatSegmentsToSrt(segments)
	}

	if (!transcriptText) {
		transcriptText = responseText
	}

	if (!transcriptText || !transcriptText.trim()) {
		throw data('Transcription failed: empty response', { status: 502 })
	}

	await prisma.transcript.upsert({
		where: { episodeId },
		create: {
			episodeId,
			contentType: 'text/plain; charset=utf-8',
			blob: Buffer.from(transcriptText, 'utf8'),
		},
		update: {
			contentType: 'text/plain; charset=utf-8',
			blob: Buffer.from(transcriptText, 'utf8'),
		},
	})

	return transcriptText
}

function formatSegmentsToSrt(
	segments: Array<{ start?: number; end?: number; text?: string }>,
) {
	const entries = segments
		.map((segment, index) => {
			const text = (segment.text ?? '').trim()
			if (!text) return null
			const start = formatSrtTimestamp(segment.start)
			const end = formatSrtTimestamp(resolveEnd(segment, segments[index + 1]))
			return `${index + 1}\n${start} --> ${end}\n${text}`
		})
		.filter(Boolean) as string[]

	return entries.join('\n\n')
}

function resolveEnd(
	segment: { end?: number; start?: number },
	next?: { start?: number },
) {
	if (typeof segment.end === 'number' && !Number.isNaN(segment.end)) {
		return segment.end
	}
	if (typeof next?.start === 'number' && !Number.isNaN(next.start)) {
		return next.start
	}
	const start = typeof segment.start === 'number' && !Number.isNaN(segment.start) ? segment.start : 0
	return start + 3
}

function formatSrtTimestamp(seconds?: number) {
	const safeSeconds =
		typeof seconds === 'number' && !Number.isNaN(seconds) && seconds >= 0 ? seconds : 0
	const hrs = Math.floor(safeSeconds / 3600)
	const mins = Math.floor((safeSeconds % 3600) / 60)
	const secs = Math.floor(safeSeconds % 60)
	const ms = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000)
	const hh = hrs.toString().padStart(2, '0')
	const mm = mins.toString().padStart(2, '0')
	const ss = secs.toString().padStart(2, '0')
	const mmm = ms.toString().padStart(3, '0')
	return `${hh}:${mm}:${ss},${mmm}`
}
