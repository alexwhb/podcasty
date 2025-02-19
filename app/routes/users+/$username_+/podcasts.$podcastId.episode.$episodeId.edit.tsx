import { useLoaderData } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import EpisodeEditor from './__episode-editor'

export async function loader({
	params,
}: {
	params: { podcastId: string; episodeId: string }
}) {
	// TODO check user here.

	if (!params.episodeId) throw new Error('episodeId is required')

	const episode = await prisma.episode.findUnique({
		where: { id: params.episodeId },
	})

	if (!episode) {
		throw new Response('Episode not found', { status: 404 })
	}

	return { episode }
}

export default function EditEpisode() {
	const { episode } = useLoaderData<typeof loader>()

	return <EpisodeEditor episode={episode} />
}
