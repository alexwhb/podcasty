import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { Outlet, useLoaderData } from 'react-router'
import { Route } from './+types/podcasts.new'
import PodcastSidebar from './__podcast-sidebar'

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)

	const podcasts = await prisma.podcast.findMany({
		where: { ownerId: userId },
	})

	return { podcasts }
}

export default function PodcastHome() {
	const { podcasts } = useLoaderData<typeof loader>()

	return (
		<div className="container mx-auto flex h-[calc(100dvh-8rem)]">
			<PodcastSidebar podcasts={podcasts} />
			<Outlet />
		</div>
	)
}
