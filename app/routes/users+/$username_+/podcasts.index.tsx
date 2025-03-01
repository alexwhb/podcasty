import { redirect } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ request }: any) {
	const userId = await requireUserId(request)

	// Query for the first podcast. You can limit it to one record.
	const firstPodcast = await prisma.podcast.findFirst({
		where: { ownerId: userId },
	})

	if (firstPodcast) {
		return redirect(`${firstPodcast.id}`)
	} else {
		return redirect(`new`)
	}
}
