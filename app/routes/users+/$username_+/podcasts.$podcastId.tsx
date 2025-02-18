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
		where: { id: params.podcastId },
	})

	if (!podcast) {
		throw new Response('Podcast not found', { status: 404 })
	}

	// For the sidebar, load the user's podcasts.
	// (Assumes that podcast.userId exists.)
	const podcasts = await prisma.podcast.findMany({
		where: { ownerId: userId },
	})

	return { podcast, podcasts }
}

export async function action({ request, params }: Route.LoaderArgs) {
	const formData = await request.formData()
	const actionType = formData.get('_action')

	if (actionType === 'delete') {
		const confirmName = formData.get('confirmName')
		const podcast = await prisma.podcast.findUnique({
			where: { id: params.podcastId },
		})
		if (!podcast) {
			throw new Response('Podcast not found', { status: 404 })
		}

		if (typeof confirmName !== 'string' || confirmName !== podcast.title) {
			return [{ error: 'Podcast name does not match.' }, { status: 400 }]
		}

		await prisma.podcast.delete({ where: { id: params.id } })
		return redirect('/podcasts')
	}

	// Otherwise, perform the update action.
	const parsed = parseWithZod(formData, { schema: PodcastEditorSchema })
	if (!parsed.value) {
		return [{ errors: parsed.errors }, { status: 400 }]
	}

	const { title, description, author, language, category } = parsed.value

	await prisma.podcast.update({
		where: { id: params.id },
		data: { title, description, author, language, category },
	})

	return { success: true }
}

// --- Main Edit Podcast Component

export default function EditPodcast() {
	const { podcast, podcasts } = useLoaderData<typeof loader>()

	return (
		<div className="container mx-auto flex h-[calc(100vh-8rem)]">
			{/* Sidebar */}

			<PodcastSidebar podcasts={podcasts} />

			{/* Main content area */}
			<PodcastEditor podcast={podcast} />
		</div>
	)
}
