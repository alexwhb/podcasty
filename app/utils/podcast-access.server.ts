import { data } from 'react-router'
import { requireUserId } from './auth.server.ts'
import { prisma } from './db.server.ts'

/**
 * Returns the signed-in user's id if they own the podcast, and throws a 404
 * otherwise (also when signed out users are redirected to login first).
 * The `$username` URL segment is never trusted for ownership.
 */
export async function requirePodcastOwner(
	request: Request,
	podcastId: string | undefined,
) {
	const userId = await requireUserId(request)
	const podcast = podcastId
		? await prisma.podcast.findFirst({
				where: { id: podcastId, ownerId: userId },
				select: { id: true },
			})
		: null
	if (!podcast) throw data('Podcast not found', { status: 404 })
	return userId
}

/** Like requirePodcastOwner, and also checks the episode is in that podcast. */
export async function requireEpisodeOwner(
	request: Request,
	podcastId: string | undefined,
	episodeId: string | undefined,
) {
	const userId = await requirePodcastOwner(request, podcastId)
	const episode = episodeId
		? await prisma.episode.findFirst({
				where: { id: episodeId, podcastId },
				select: { id: true },
			})
		: null
	if (!episode) throw data('Episode not found', { status: 404 })
	return userId
}
