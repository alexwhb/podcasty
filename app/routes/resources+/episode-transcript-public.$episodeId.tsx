import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params, request }: { params: { episodeId?: string }; request: Request }) {
	const episodeId = params.episodeId
	if (!episodeId) throw data('Episode id is required', { status: 400 })

	const method = request.method.toUpperCase()
	if (method !== 'GET' && method !== 'HEAD') {
		throw data('Method not allowed', { status: 405 })
	}

	const episode = await prisma.episode.findUnique({
		where: { id: episodeId, isPublished: true },
		select: { id: true },
	})
	if (!episode) throw data('Not found', { status: 404 })

	const transcript = await prisma.transcript.findUnique({
		where: { episodeId },
		select: { blob: true, contentType: true },
	})
	const contentType = transcript?.contentType || 'text/plain; charset=utf-8'
	const headers = new Headers({
		'Content-Type': contentType,
		'Cache-Control': 'public, max-age=3600',
	})

	if (method === 'HEAD') {
		return new Response(null, { status: 200, headers })
	}

	if (!transcript) {
		return new Response('', { status: 200, headers })
	}

	const text = Buffer.from(transcript.blob).toString('utf8')
	return new Response(text, { status: 200, headers })
}
