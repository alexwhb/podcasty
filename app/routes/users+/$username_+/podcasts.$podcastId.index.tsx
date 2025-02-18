import { prisma } from '#app/utils/db.server.ts'
import { Route } from './+types/podcasts.$podcastId'
import { requireUserId } from '#app/utils/auth.server.ts'
import { Link, useLoaderData } from 'react-router'
import { PencilIcon } from 'lucide-react'
import { Button } from '#app/components/ui/button.tsx'

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

// --- Main Edit Podcast Component
export default function PodcastInfo() {
	const { podcast } = useLoaderData<typeof loader>()

	return (
		<div className="mx-auto max-w-4xl p-6">
			{/* Main content */}
			<div className="mt-4 flex flex-col gap-6 md:flex-row">
				<div className="w-full md:w-1/3">
					<img
						src="https://placehold.co/300"
						alt="Podcast Cover"
						width={300}
						height={300}
						className="w-full rounded-lg shadow-lg"
					/>
				</div>
				<div className="w-full space-y-4 md:w-2/3">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white md:text-4xl">
						{podcast?.title || 'N/A'}
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-200">
						Created by{' '}
						<span className="text-xl font-semibold">
							{podcast?.author || 'N/A'}
						</span>
					</p>
					<div
						className="mt-4 leading-relaxed text-gray-700 dark:text-gray-200"
						dangerouslySetInnerHTML={{ __html: podcast?.description || 'N/A' }}
					/>
				</div>
				{/* Header row with the icon aligned to the right */}
				<div className="flex justify-end">
					<Link to={`edit`}>
						<Button className="rounded-full p-2 shadow">
							<PencilIcon />
						</Button>
					</Link>
				</div>
			</div>
		</div>
	)
}
