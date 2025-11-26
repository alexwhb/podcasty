import { env } from 'node:process'
import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'

const MAX_AUDIO_BYTES = 50 * 1024 * 1024 // 50MB
const ALLOWED_AUDIO_MIME_PREFIXES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac']

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
}: {
	episodeId: string
	userId: string
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

	const audioResponse = await fetch(episode.audioUrl)
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
	form.set('file', file)
	form.set('model', config.model)

	let response: Response
	if (config.kind === 'openai') {
		response = await fetch(
			'https://api.openai.com/v1/audio/transcriptions',
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: form,
			},
		)
	} else {
		const headers: Record<string, string> = {}
		if (config.authHeader) {
			headers.Authorization = config.authHeader
		}
		response = await fetch(config.endpoint, {
			method: 'POST',
			headers,
			body: form,
		})
	}

	if (!response.ok) {
		const errorText = await response.text().catch(() => 'Unknown error')
		throw data(`Transcription failed: ${errorText}`, {
			status: 502,
		})
	}

	const result = (await response.json()) as { text?: string }
	if (!result.text) {
		throw data('Transcription failed: empty response', { status: 502 })
	}

	await prisma.transcript.upsert({
		where: { episodeId },
		create: {
			episodeId,
			contentType: 'text/plain; charset=utf-8',
			blob: Buffer.from(result.text, 'utf8'),
		},
		update: {
			contentType: 'text/plain; charset=utf-8',
			blob: Buffer.from(result.text, 'utf8'),
		},
	})

	return result.text
}
