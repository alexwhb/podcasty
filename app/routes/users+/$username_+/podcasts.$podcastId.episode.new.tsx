import { requireUserId } from '#app/utils/auth.server.ts'

import { Route } from './+types/podcasts.$podcastId.episode.new'
import EpisodeEditor from './__episode-editor'

export async function loader({  request }: Route.LoaderArgs) {
	await requireUserId(request)

	return {  }
}

export default function EditEpisode({
	actionData,
}: Route.ComponentProps) {
	return <EpisodeEditor  actionData={actionData} />
}

