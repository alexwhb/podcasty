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

export async function loader({ params, request }: LoaderFunctionArgs) {
	const episodeParam = params.episodeId
	if (!episodeParam) throw data('Episode id is required', { status: 400 })

	const episodeId = episodeParam.split('.')[0]

	const episode = await prisma.episode.findUnique({
		where: { id: episodeId },
		select: {
			audioUrl: true,
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

	return redirect(targetUrl, { status: 302 })
}

export default function AudioRedirect() {
	return null
}
