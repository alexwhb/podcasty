import { requireUserId } from '#app/utils/auth.server.ts'
import { type Route } from './+types/podcasts.$podcastId.episode.new'
import EpisodeEditor from './__episode-editor'
export { action } from './__episode-editor.server.tsx'


export async function loader({  request }: Route.LoaderArgs) {
	await requireUserId(request)

	return {  }
}

export default function EditEpisode({
	actionData,
}: Route.ComponentProps) {
	return <EpisodeEditor  actionData={actionData} />
}

