import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useLoaderData } from 'react-router'
import { type Route } from './+types/notes.new.ts'
import PodcastEditor from './__podcast-editor.tsx'
import PodcastSidebar from './__podcast-sidebar.tsx'
export { action } from './__note-editor.server.tsx'

// export async function loader({ request }: Route.LoaderArgs) {
// 	const userId = await requireUserId(request)
// 	// For the sidebar, load the user's podcasts.
// 	// (Assumes that podcast.userId exists.)
// 	const podcasts = await prisma.podcast.findMany({
// 		where: { ownerId: userId },
// 	})

// 	return { podcasts }
// }

export default function New() {
	return <PodcastEditor />
}
