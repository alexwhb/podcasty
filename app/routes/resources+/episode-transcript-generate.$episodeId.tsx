import { data } from 'react-router'
import { z } from 'zod'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getDomainUrl } from '#app/utils/misc.tsx'
import { getWhisperConfig } from '#app/utils/whisper.server.ts'
import { type Route } from './+types/episode-transcript-generate.$episodeId.ts'

export async function action({ params, request }: Route.ActionArgs) {
	const userId = await requireUserId(request)
	const episodeId = params.episodeId
	if (!episodeId) throw data('Episode id is required', { status: 400 })

	const config = getWhisperConfig()
	if (!config.enabled) {
		return data(
			{
				success: false,
				error: config.reason,
			},
			{ status: 400 },
		)
	}

	// ensure user owns episode and get audio URL
	const episode = await prisma.episode.findFirst({
		where: { id: episodeId, podcast: { ownerId: userId } },
		select: { audioUrl: true },
	})
	if (!episode?.audioUrl) {
		throw data('Episode audio not found', { status: 404 })
	}
	const audioUrl =
		episode.audioUrl.startsWith('http')
			? episode.audioUrl
			: new URL(episode.audioUrl, getDomainUrl(request)).toString()

	const job = await prisma.job.create({
		data: {
			type: 'transcription',
			payload: {
				episodeId,
				userId,
				audioUrl,
			},
		},
		select: { id: true },
	})

	return data({ success: true, queued: true, jobId: job.id })
}
