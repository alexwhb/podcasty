import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { data, redirect, type LoaderFunctionArgs } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { getDomainUrl } from '#app/utils/misc.tsx'

function getClientIp(request: Request) {
	const headers = request.headers
	const forwarded = headers.get('x-forwarded-for') || headers.get('cf-connecting-ip')
	if (forwarded) {
		return forwarded.split(',')[0]?.trim() || null
	}
	return headers.get('x-real-ip') || null
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
	const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
	const start = Number(startStr)
	if (Number.isNaN(start) || start < 0 || start >= size) return 'invalid'
	const end = endStr ? Number(endStr) : size - 1
	const normalizedEnd = Number.isNaN(end) || end >= size ? size - 1 : end
	if (normalizedEnd < start) return 'invalid'
	return { start, end: normalizedEnd }
}

function resolveLocalAudioPath(audioUrl: string) {
	const withoutQuery = audioUrl.split('?')[0]
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

	const rangeResult = parseRange(request.headers.get('range'), stats.size)
	const headers: Record<string, string> = {
		'Accept-Ranges': 'bytes',
		'Content-Type': audioType || 'audio/mpeg',
		'Cache-Control': 'public, max-age=3600',
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
				: Readable.toWeb(fs.createReadStream(filePath))
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
			: Readable.toWeb(fs.createReadStream(filePath, { start, end }))

	return new Response(body, {
		status: 206,
		headers,
	})
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const episodeParam = params.episodeId
	if (!episodeParam) throw data('Episode id is required', { status: 400 })

	const episodeId = episodeParam.split('.')[0]

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

	// Fire-and-forget logging; we don't block the redirect on logging failures.
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

	const localResponse = await maybeServeLocalAudio({
		audioUrl: episode.audioUrl,
		request,
		audioType: episode.audioType,
	})
	if (localResponse) return localResponse

	return redirect(targetUrl, { status: 302 })
}

export default function AudioRedirect() {
	return null
}
