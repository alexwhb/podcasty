import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { redirect } from 'react-router'
import { Route } from './+types/podcasts'

export async function loader({ params, request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const podcast = await prisma.podcast.findFirst({
		where: { ownerId: userId },
		select: { id: true },
	})

	return redirect(`/users/${params.username}/podcasts/${podcast?.id}`)
}
