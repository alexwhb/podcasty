import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { data, redirect, type LoaderFunctionArgs } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { getDomainUrl } from '#app/utils/misc.tsx'

function buildWeakEtag(stats: fs.Stats) {
	return `W/"${stats.mtimeMs.toString(16)}-${stats.size.toString(16)}"`
}

// nginx sets X-Real-IP to the connecting address and appends it to
// X-Forwarded-For. Earlier X-Forwarded-For entries come from the client and
// can be spoofed, so only the last one is used.
function getClientIp(request: Request) {
	const headers = request.headers
	const realIp = headers.get('x-real-ip')
	if (realIp) return realIp.trim()
	const forwarded = headers.get('x-forwarded-for')
	return forwarded?.split(',').pop()?.trim() || null
}

function truncate(value: string | null, max = 512) {
	if (!value) return null
	return value.length > max ? value.slice(0, max) : value
}

function buildAudioUrl(audioUrl: string, request: Request, baseUrl?: string | null) {
	if (!audioUrl) return null
	if (audioUrl.startsWith('http')) return audioUrl
	const origin = baseUrl || getDomainUrl(request)
	try {
		return new URL(audioUrl, origin).toString()
	} catch {
		return audioUrl
	}
}

function parseRange(rangeHeader: string | null, size: number) {
	if (!rangeHeader) return null
	if (!rangeHeader.startsWith('bytes=')) return null
	// A single integer range only. Malformed ("1.5", "0x10") and multi-range
	// headers are ignored, as RFC 9110 allows, and get the full file.
	const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
	if (!match) return null
	const [, startStr = '', endStr = ''] = match
	if (!startStr && !endStr) return null
	if (!startStr) {
		// Suffix range: the last N bytes.
		const length = Number(endStr)
		if (length === 0) return 'invalid'
		return { start: Math.max(size - length, 0), end: size - 1 }
	}
	const start = Number(startStr)
	if (start >= size) return 'invalid'
	const end = endStr ? Math.min(Number(endStr), size - 1) : size - 1
	if (end < start) return 'invalid'
	return { start, end }
}

function resolveLocalAudioPath(audioUrl: string) {
	const [withoutQuery = ''] = audioUrl.split('?')
	if (withoutQuery.startsWith('http')) return null
	const relativePath = withoutQuery.startsWith('/')
		? withoutQuery.slice(1)
		: withoutQuery
	const fullPath = path.resolve(process.cwd(), relativePath)
	const uploadsDir = path.resolve(process.cwd(), 'uploads')
	if (!fullPath.startsWith(uploadsDir)) return null
	return fullPath
}

async function maybeServeLocalAudio({
	audioUrl,
	request,
	audioType,
}: {
	audioUrl: string
	request: Request
	audioType?: string | null
}) {
	const filePath = resolveLocalAudioPath(audioUrl)
	if (!filePath) return null

	const stats = await fs.promises.stat(filePath).catch(() => null)
	if (!stats?.isFile()) return null

	const etag = buildWeakEtag(stats)
	const lastModified = stats.mtime.toUTCString()
	const rangeHeader = request.headers.get('range')
	const ifRange = request.headers.get('if-range')
	const shouldHonorRange =
		!ifRange || ifRange === etag || new Date(ifRange).toUTCString() === lastModified
	const effectiveRangeHeader = shouldHonorRange ? rangeHeader : null

	const rangeResult = parseRange(effectiveRangeHeader, stats.size)
	const headers: Record<string, string> = {
		'Accept-Ranges': 'bytes',
		'Content-Type': audioType || 'audio/mpeg',
		'Cache-Control': 'public, max-age=3600',
		ETag: etag,
		'Last-Modified': lastModified,
	}

	if (!rangeResult && (request.method === 'GET' || request.method === 'HEAD')) {
		const ifNoneMatch = request.headers.get('if-none-match')
		if (ifNoneMatch === '*' || ifNoneMatch?.split(',').map((v) => v.trim()).includes(etag)) {
			return new Response(null, { status: 304, headers })
		}
		const ifModifiedSince = request.headers.get('if-modified-since')
		if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= stats.mtime.getTime()) {
			return new Response(null, { status: 304, headers })
		}
	}

	if (rangeResult === 'invalid') {
		return new Response(null, {
			status: 416,
			headers: {
				...headers,
				'Content-Range': `bytes */${stats.size}`,
			},
		})
	}

	if (!rangeResult) {
		headers['Content-Length'] = `${stats.size}`
		const body =
			request.method === 'HEAD'
				? null
				: (Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream)
		return new Response(body, {
			status: 200,
			headers,
		})
	}

	const { start, end } = rangeResult
	headers['Content-Length'] = `${end - start + 1}`
	headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`
	const body =
		request.method === 'HEAD'
			? null
			: (Readable.toWeb(
					fs.createReadStream(filePath, { start, end }),
				) as ReadableStream)

	return new Response(body, {
		status: 206,
		headers,
	})
}

async function proxyRemoteAudio({
	targetUrl,
	request,
	audioType,
}: {
	targetUrl: string
	request: Request
	audioType?: string | null
}) {
	const method = request.method === 'HEAD' ? 'HEAD' : 'GET'
	const outgoingHeaders = new Headers()
	const rangeHeader = request.headers.get('range')
	if (rangeHeader) outgoingHeaders.set('Range', rangeHeader)
	const acceptHeader = request.headers.get('accept')
	if (acceptHeader) outgoingHeaders.set('Accept', acceptHeader)
	const ifNoneMatch = request.headers.get('if-none-match')
	if (ifNoneMatch) outgoingHeaders.set('If-None-Match', ifNoneMatch)
	const ifModifiedSince = request.headers.get('if-modified-since')
	if (ifModifiedSince) outgoingHeaders.set('If-Modified-Since', ifModifiedSince)
	const ifRange = request.headers.get('if-range')
	if (ifRange) outgoingHeaders.set('If-Range', ifRange)

	const upstreamResponse = await fetch(targetUrl, {
		method,
		headers: outgoingHeaders,
		redirect: 'follow',
	})

	const headers = new Headers(upstreamResponse.headers)
	headers.set('Accept-Ranges', 'bytes')
	const resolvedType = audioType || 'audio/mpeg'
	const upstreamType = headers.get('content-type')
	if (!upstreamType || !upstreamType.toLowerCase().startsWith('audio/')) {
		headers.set('Content-Type', resolvedType)
	}
	if (!headers.has('cache-control')) headers.set('Cache-Control', 'public, max-age=3600')

	let sizeHeader = headers.get('content-length')
	let size = sizeHeader ? Number(sizeHeader) : null
	let hasValidSize = typeof size === 'number' && Number.isFinite(size) && size >= 0

	// If a Range was requested but upstream did not give us a size, try a HEAD request to discover it.
	if (rangeHeader && !hasValidSize) {
		const headResponse = await fetch(targetUrl, {
			method: 'HEAD',
			headers: outgoingHeaders,
			redirect: 'follow',
		})
		const headLength = headResponse.headers.get('content-length')
		if (headLength) {
			sizeHeader = headLength
			size = Number(headLength)
			hasValidSize = typeof size === 'number' && Number.isFinite(size) && size >= 0
			if (!headers.has('content-length') && hasValidSize) {
				headers.set('Content-Length', headLength)
			}
		}
	}

	const rangeResult = rangeHeader && hasValidSize ? parseRange(rangeHeader, size!) : null
	if (rangeHeader && !rangeResult && !hasValidSize) {
		return new Response(method === 'HEAD' ? null : upstreamResponse.body, {
			status: upstreamResponse.status === 200 ? 200 : upstreamResponse.status,
			headers,
		})
	}

	if (rangeResult === 'invalid') {
		return new Response(null, {
			status: 416,
			headers: {
				...Object.fromEntries(headers),
				'Accept-Ranges': 'bytes',
				'Content-Range': `bytes */${hasValidSize ? size : '*'}`,
			},
		})
	}

	if (rangeResult && headers.has('content-range') && upstreamResponse.status === 206) {
		if (!headers.has('accept-ranges')) headers.set('Accept-Ranges', 'bytes')
		return new Response(method === 'HEAD' ? null : upstreamResponse.body, {
			status: 206,
			headers,
		})
	}

	if (rangeResult && hasValidSize) {
		const { start, end } = rangeResult
		headers.set('Accept-Ranges', 'bytes')
		headers.set('Content-Length', `${end - start + 1}`)
		headers.set('Content-Range', `bytes ${start}-${end}/${size}`)

		if (method === 'HEAD' || !upstreamResponse.body) {
			return new Response(null, { status: 206, headers })
		}

		let remaining = end - start + 1
		let toSkip = start
		const reader = upstreamResponse.body.getReader()

		const stream = new ReadableStream({
			async pull(controller) {
				if (remaining <= 0) {
					controller.close()
					reader.cancel().catch(() => {})
					return
				}

				const { done, value } = await reader.read()
				if (done || !value) {
					controller.close()
					return
				}

				let chunk = value
				if (toSkip > 0) {
					if (toSkip >= chunk.length) {
						toSkip -= chunk.length
						return
					}
					chunk = chunk.slice(toSkip)
					toSkip = 0
				}

				if (chunk.length > remaining) {
					controller.enqueue(chunk.slice(0, remaining))
					remaining = 0
					controller.close()
					reader.cancel().catch(() => {})
				} else {
					controller.enqueue(chunk)
					remaining -= chunk.length
					if (remaining <= 0) {
						controller.close()
						reader.cancel().catch(() => {})
					}
				}
			},
			cancel() {
				reader.cancel().catch(() => {})
			},
		})

		return new Response(stream, { status: 206, headers })
	}

	const body = method === 'HEAD' ? null : upstreamResponse.body

	return new Response(body, {
		status: upstreamResponse.status,
		headers,
	})
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const episodeParam = params.episodeId
	if (!episodeParam) throw data('Episode id is required', { status: 400 })

	const [episodeId = ''] = episodeParam.split('.')

	const episode = await prisma.episode.findUnique({
		where: { id: episodeId },
		select: {
			audioUrl: true,
			audioType: true,
			podcastId: true,
			podcast: { select: { baseUrl: true } },
		},
	})

	if (!episode || !episode.audioUrl) {
		throw data('Episode not found', { status: 404 })
	}

	const targetUrl = buildAudioUrl(episode.audioUrl, request, episode.podcast.baseUrl)
	if (!targetUrl) throw data('Audio URL not configured', { status: 404 })

	const userAgent = truncate(request.headers.get('user-agent'))
	const referer =
		truncate(request.headers.get('referer')) ||
		truncate(request.headers.get('referrer'))
	const range = truncate(request.headers.get('range'))
	const ip = truncate(getClientIp(request))

	// Only count requests that actually send audio: not HEAD, 304 or 416.
	const recordDownload = (response: Response) => {
		if (request.method !== 'GET') return
		if (response.status !== 200 && response.status !== 206) return
		// Fire-and-forget; a logging failure shouldn't fail the request.
		prisma.episodeDownload
			.create({
				data: {
					episodeId,
					podcastId: episode.podcastId,
					userAgent,
					referer,
					range,
					ip,
				},
			})
			.catch((error) => {
				console.error('Failed to record episode download', error)
			})
	}

	const localResponse = await maybeServeLocalAudio({
		audioUrl: episode.audioUrl,
		request,
		audioType: episode.audioType,
	})
	if (localResponse) {
		recordDownload(localResponse)
		return localResponse
	}

	try {
		const response = await proxyRemoteAudio({
			targetUrl,
			request,
			audioType: episode.audioType,
		})
		recordDownload(response)
		return response
	} catch (error) {
		console.error('Failed to proxy remote audio', error)
		return redirect(targetUrl, { status: 302 })
	}
}
