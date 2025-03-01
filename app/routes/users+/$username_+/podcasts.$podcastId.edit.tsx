import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { type Route } from './+types/podcasts.$podcastId.edit'
import PodcastEditor from './__podcast-editor'

export { action } from './__podcast-editor.server.tsx'

export async function loader({ params, request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const podcast = await prisma.podcast.findUnique({
		where: { id: params.podcastId, ownerId: userId },
		include: {
    		image: true,
  		},
	})

	if (!podcast) {
		throw new Response('Podcast not found', { status: 404 })
	}

	return { podcast }
}

export default function EditPodcast({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	return <PodcastEditor podcast={loaderData.podcast} actionData={actionData} />
}
