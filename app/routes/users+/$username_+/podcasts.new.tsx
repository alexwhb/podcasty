import PodcastEditor from './__podcast-editor.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
export { action } from './__podcast-editor.server.tsx'

export async function loader({ request }: Route.LoaderArgs) {
	await requireUserId(request)
	return {}
}

export default function New({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	return <PodcastEditor podcast={loaderData} actionData={actionData}/>
}
