import { prisma } from '#app/utils/db.server.ts'
import { type Route } from './+types/podcasts.$podcastId.episode.$episodeId.edit.ts'
import EpisodeEditor from './__episode-editor'

export { action } from './__episode-editor.server.tsx'

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

export default function EditEpisode({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	return <EpisodeEditor episode={loaderData.episode} actionData={actionData} />
}
