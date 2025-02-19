import { useLoaderData } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { Route } from './+types/podcasts.$podcastId'
import { requireUserId } from '#app/utils/auth.server.ts'
import PodcastEditor from './__podcast-editor'
import { action } from './__podcast-editor.server'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'

// TODO maybe load this from context?

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
