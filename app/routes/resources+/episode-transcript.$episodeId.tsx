import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

async function assertEpisodeOwner(userId: string, episodeId: string) {
	const owned = await prisma.episode.findFirst({
		where: { id: episodeId, podcast: { ownerId: userId } },
		select: { id: true },
	})
	if (!owned) throw data('Not found', { status: 404 })
}

export async function loader({ params, request }: { params: { episodeId: string }; request: Request }) {
	const userId = await requireUserId(request)
	const episodeId = params.episodeId
	if (!episodeId) throw data('Episode id is required', { status: 400 })
	await assertEpisodeOwner(userId, episodeId)

	const transcript = await prisma.transcript.findUnique({
		where: { episodeId },
		select: { blob: true, contentType: true },
	})

	if (!transcript) {
		return data({ transcript: '' }, { status: 200 })
	}

	const text = Buffer.from(transcript.blob).toString('utf8')
	return data({ transcript: text }, { status: 200 })
}

export async function action({ params, request }: { params: { episodeId: string }; request: Request }) {
	const userId = await requireUserId(request)
	const episodeId = params.episodeId
	if (!episodeId) throw data('Episode id is required', { status: 400 })
	await assertEpisodeOwner(userId, episodeId)

	if (request.method.toUpperCase() === 'DELETE') {
		await prisma.transcript.deleteMany({ where: { episodeId } })
		return data({ success: true })
	}

	const formData = await request.formData()
	const text = formData.get('transcript')
	if (typeof text !== 'string') {
		return data({ error: 'Transcript is required' }, { status: 400 })
	}

	await prisma.transcript.upsert({
		where: { episodeId },
		create: { episodeId, contentType: 'text/plain; charset=utf-8', blob: Buffer.from(text, 'utf8') },
		update: { contentType: 'text/plain; charset=utf-8', blob: Buffer.from(text, 'utf8') },
	})

	return data({ success: true })
}
