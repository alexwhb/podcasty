// --- UI Components

import { Button } from '#app/components/ui/button.tsx'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'

// Sidebar updated to receive an array of podcast objects.
export default function PodcastSidebar({
	podcasts,
}: {
	podcasts: Array<{ id: number | string; title: string }>
}) {
	return (
		<aside
			className={`w-64 flex-shrink-0 border-r bg-background transition-transform duration-300 ease-in-out md:translate-x-0`}
		>
			<div className="flex h-full flex-col">
				<div className="p-4">
					<h2 className="text-lg font-semibold">My Podcasts</h2>
				</div>
				<nav className="flex-1 overflow-y-auto">
					<ul className="space-y-1 p-2">
						{podcasts.map((podcast) => (
							<li key={podcast.id}>
								<Button variant="ghost" className="w-full justify-start">
									{podcast.title}
								</Button>
							</li>
						))}
					</ul>
				</nav>
				<div className="p-4">
					<Link to="../new" relative="path">
						<Button className="w-full">
							<Plus className="mr-2 h-4 w-4" /> Add Podcast
						</Button>
					</Link>
				</div>
			</div>
		</aside>
	)
}
