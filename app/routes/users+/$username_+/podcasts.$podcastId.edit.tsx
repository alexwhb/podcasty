import { redirect } from '@remix-run/server-runtime'
import { useLoaderData } from 'react-router'
import { parseWithZod } from '@conform-to/zod'
import { prisma } from '#app/utils/db.server.ts'
import { Route } from './+types/podcasts.$podcastId'
import { requireUserId } from '#app/utils/auth.server.ts'
import PodcastEditor from './__podcast-editor'
import PodcastSidebar from './__podcast-sidebar'

// --- Loader & Action

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

export default function EditPodcast() {
	const { podcast } = useLoaderData<typeof loader>()

	return <PodcastEditor podcast={podcast} />
}
