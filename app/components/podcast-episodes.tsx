// PodcastEpisodes.tsx
import { useEffect } from 'react'
import { Button } from '#app/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import { Input } from '#app/components/ui/input'
import { ArrowUpDown, PlusIcon } from 'lucide-react'
import { Link } from 'react-router'

interface Episode {
	id: string
	title: string
	description: string
	pubDate: string
	explicit: boolean
	duration: number
	season?: number
	number?: number
}

interface Podcast {
	id: string
	title: string
	image?: string
	episodes: Episode[]
}

interface PodcastEpisodesProps {
	podcast: Podcast
	episodes: Episode[]
	totalEpisodes: number
	onSearch: (query: string) => void
	onSortToggle: (newSort: 'asc' | 'desc') => void
	onLoadMore: () => void
	onDeleteEpisode: (episodeId: string) => void
	currentSort: 'asc' | 'desc'
	isLoading: boolean
	// For search field styling and clear functionality.
	localSearch: string
	setLocalSearch: React.Dispatch<React.SetStateAction<string>>
	clearSearch: () => void
}

function formatPubDate(dateString: string): string {
	const date = new Date(dateString)
	const options: Intl.DateTimeFormatOptions = {
		month: '2-digit',
		day: '2-digit',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	}
	return date.toLocaleString('en-US', options)
}

function formatDuration(seconds: number): string {
	const hrs = Math.floor(seconds / 3600)
	const mins = Math.floor((seconds % 3600) / 60)
	const secs = seconds % 60
	return [hrs, mins, secs].map((num) => String(num).padStart(2, '0')).join(':')
}

export default function PodcastEpisodes({
	podcast,
	episodes,
	totalEpisodes,
	onSearch,
	onSortToggle,
	onLoadMore,
	onDeleteEpisode,
	currentSort,
	isLoading,
	localSearch,
	setLocalSearch,
	clearSearch,
}: PodcastEpisodesProps) {
	// Debounce effect to call onSearch when localSearch changes
	useEffect(() => {
		const timer = setTimeout(() => {
			onSearch(localSearch)
		}, 300)
		return () => clearTimeout(timer)
	}, [localSearch, onSearch])

	// Toggle sort order handler
	function toggleSort() {
		const newSort = currentSort === 'asc' ? 'desc' : 'asc'
		onSortToggle(newSort)
	}

	// Delete handler
	function handleDelete(episodeId: string) {
		if (confirm('Are you sure you want to delete this episode?')) {
			onDeleteEpisode(episodeId)
		}
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<h1 className="mb-8 text-3xl font-bold">Episodes</h1>

			{/* Search and Sort Controls */}
			<div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				{/* Search Input with Clear Button */}
				<div className="relative w-full max-w-md">
					<Input
						type="search"
						value={localSearch}
						onChange={(e) => setLocalSearch(e.target.value)}
						placeholder="Search episodes..."
						className="w-full pr-10" // extra right padding for the clear button
					/>
					{localSearch && (
						<button
							type="button"
							onClick={clearSearch}
							className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-500 hover:text-gray-700"
						>
							×
						</button>
					)}
				</div>

				<div className="flex gap-2">
					<Link to="./episode/new" prefetch="intent">
						<Button>
							<PlusIcon /> Add Episode
						</Button>
					</Link>

					<Button onClick={toggleSort}>
						<ArrowUpDown />
						Sort
					</Button>
				</div>
			</div>

			{/* Episodes List */}
			{episodes.map((episode: Episode) => (
				<div key={episode.id} className="flex items-center border-b py-4">
					<div className="mr-4 flex-shrink-0">
						<img
							src="https://placehold.co/60"
							alt="Episode Thumbnail"
							className="rounded-md object-cover"
						/>
					</div>
					<div className="flex-grow">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<h2 className="text-lg font-bold">{episode.title}</h2>
								{episode.explicit && (
									<span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-800">
										Explicit
									</span>
								)}
							</div>
							{episode.season !== undefined && episode.number !== undefined && (
								<div className="text-sm text-gray-600">
									{`S ${episode.season} E ${episode.number}`}
								</div>
							)}
						</div>
						<div className="text-sm text-gray-600 dark:text-gray-400">
							{formatPubDate(episode.pubDate)}
							<span className="mx-2">|</span>
							{formatDuration(episode.duration)}
						</div>
					</div>
					<div className="ml-4">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
									<span>⋮</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem asChild>
									<Link to={`./episode/${episode.id}/edit`} prefetch="intent">
										Edit
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => handleDelete(episode.id)}>
									Delete
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<a href="#">Unpublish</a>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<a href="#">Share</a>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			))}

			{/* Load More Button */}
			{episodes.length < totalEpisodes && (
				<div className="mt-6 flex justify-center">
					<Button onClick={onLoadMore} disabled={isLoading}>
						{isLoading ? 'Loading...' : 'Load More'}
					</Button>
				</div>
			)}
		</div>
	)
}
