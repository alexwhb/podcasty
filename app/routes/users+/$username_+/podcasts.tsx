import { Plus } from 'lucide-react'
import * as React from 'react'
import { type ReactNode } from 'react'

import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '#app/components/ui/select.tsx'

import { Switch } from '#app/components/ui/switch.tsx'
import { Textarea } from '#app/components/ui/textarea'
import { Button } from '#app/components/ui/button.tsx'
// Sample data for podcasts
const podcasts = [
	{ id: 1, title: 'Tech Talk' },
	{ id: 2, title: 'Science Hour' },
	{ id: 3, title: 'History Unveiled' },
]

export default function PodcastManager() {
	const [sidebarOpen, setSidebarOpen] = React.useState(false)

	return (
		<div className="container mx-auto flex-1 p-4">
			<div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-lg border shadow-sm">
				{/* Sidebar */}
				<aside
					className={`w-64 flex-shrink-0 border-r bg-background transition-all duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
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
							<Button className="w-full">
								<Plus className="mr-2 h-4 w-4" /> Add Podcast
							</Button>
						</div>
					</div>
				</aside>

				{/* Main content area */}
				<main className="flex-1 overflow-y-auto p-6">
					<Button
						variant="outline"
						size="sm"
						className="mb-4 md:hidden"
						onClick={() => setSidebarOpen(!sidebarOpen)}
					>
						{sidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
					</Button>
					<h1 className="mb-6 text-2xl font-bold">Edit Podcast</h1>
					<form className="space-y-6">
						<div>
							<Label htmlFor="title">Title</Label>
							<Input id="title" placeholder="Enter podcast title" />
						</div>
						<div>
							<Label htmlFor="description">Description</Label>
							<Textarea
								id="description"
								placeholder="Enter podcast description"
							/>
						</div>
						<div className="flex items-center space-x-2">
							<Switch id="explicit" />
							<Label htmlFor="explicit">Explicit Content</Label>
						</div>
						<div>
							<Label htmlFor="language">Language</Label>
							<Select>
								<SelectTrigger id="language">
									<SelectValue placeholder="Select a language" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="en">English</SelectItem>
									<SelectItem value="es">Spanish</SelectItem>
									<SelectItem value="fr">French</SelectItem>
									<SelectItem value="de">German</SelectItem>
									<SelectItem value="ja">Japanese</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button type="submit">Save Changes</Button>
					</form>
				</main>
			</div>
		</div>
	)
}
