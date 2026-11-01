import { Outlet } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getEpisodeFiles, removeStoredFiles } from '#app/utils/storage-cleanup.server.ts'
import { type Route } from '../../../../.react-router/types/app/routes/users+/$username_+/+types/podcasts.$podcastId.ts'

export async function action({ params, request }: Route.ActionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('_action')

	if (intent === 'delete') {
		const episodeId = formData.get('episodeId') as string
		if (!episodeId) {
			throw new Response('Episode ID is required', { status: 400 })
		}

		// Ensure the user owns the podcast before deleting
		const podcast = await prisma.podcast.findUnique({
			where: { id: params.podcastId, ownerId: userId },
		})

		if (!podcast) {
			throw new Response('Podcast episode not found', { status: 404 })
		}

		const episode = await prisma.episode.findFirst({
			where: { id: episodeId, podcastId: podcast.id },
			select: { id: true },
		})
		if (!episode) {
			throw new Response('Podcast episode not found', { status: 404 })
		}
		const files = await getEpisodeFiles(episode.id)
		await prisma.episode.delete({ where: { id: episode.id } })
		await removeStoredFiles(files)

		return null
	}

	throw new Response('Invalid action', { status: 400 })
}

export default function PodcastInfo() {
	return <Outlet />
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.podcastId}" exists</p>
				),
			}}
		/>
	)
}
