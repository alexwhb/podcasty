import PodcastEditor from './__podcast-editor.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
export { action } from './__podcast-editor.server.tsx'
import { Route } from './+types/podcasts.new.ts'

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserId(request)
	return {}
}

export default function New({
	actionData,
}: Route.ComponentProps) {
	return <PodcastEditor  actionData={actionData}/>
}
