import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { Route } from '../../podcast+/+types/$id.episodes.$episodeId.edit'

export async function loader({ params, request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const podcast = await prisma.podcast.findUnique({
		where: { id: params.podcastId, ownerId: userId },
	})

	if (!podcast) {
		throw new Response('Podcast not found', { status: 404 })
	}

	return { podcast }
}

export default function NewEpisodeForm() {
	return (
		<h1 className="mt-16 w-full text-center text-4xl font-bold">
			New Episode Form
		</h1>
	)
}
