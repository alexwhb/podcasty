import { requirePodcastOwner } from '#app/utils/podcast-access.server.ts'
import { type Route } from './+types/podcasts.$podcastId.episode.new'
import EpisodeEditor from './__episode-editor'
export { action } from './__episode-editor.server.tsx'


export async function loader({ params, request }: Route.LoaderArgs) {
	await requirePodcastOwner(request, params.podcastId)

	return {  }
}

export default function EditEpisode({
	actionData,
}: Route.ComponentProps) {
	return <EpisodeEditor  actionData={actionData} />
}

