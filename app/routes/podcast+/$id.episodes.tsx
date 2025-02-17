import { useState, useEffect, ReactNode } from 'react'
import { json } from '@remix-run/server-runtime'
import { prisma } from '#app/utils/db.server.ts'

// ShadCN components imports (adjust these imports as needed)
import { Button } from '#app/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import {
	Link,
	useLoaderData,
	useFetcher,
	useSearchParams,
	useNavigation,
	LoaderFunctionArgs,
} from 'react-router'
import { Input } from '#app/components/ui/input.tsx'
import { ArrowUpDown } from 'lucide-react'

// Update the type based on your actual DB schema.
// Note: Added "duration" to the Episode type.
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

interface LoaderData {
	podcast: Podcast
	totalEpisodes: number
	page: number
}

const PAGE_SIZE = 10

export async function loader({ request, params }: LoaderFunctionArgs<any>) {
	const url = new URL(request.url)
	const pageParam = url.searchParams.get('page')
	const q = url.searchParams.get('q') || ''
	const sortParam = url.searchParams.get('sort')
	const page = pageParam ? parseInt(pageParam) : 1
	const sort = sortParam === 'asc' || sortParam === 'desc' ? sortParam : 'desc'
	const skip = (page - 1) * PAGE_SIZE

	// First get the podcast (we assume it always exists)
	const podcast = await prisma.podcast.findUnique({
		where: { id: params.id },
	})
	if (!podcast) {
		throw new Response('Podcast not found', { status: 404 })
	}

	// Then fetch the episodes matching our search and sort criteria.
	const episodes = await prisma.episode.findMany({
		where: {
			podcastId: params.id,
			title: { contains: q },
		},
		orderBy: { pubDate: sort },
		skip,
		take: PAGE_SIZE,
	})

	// Count the total matching episodes
	const totalEpisodes = await prisma.episode.count({
		where: {
			podcastId: params.id,
			title: { contains: q },
		},
	})

	return json({
		podcast,
		episodes,
		totalEpisodes,
		page,
		sort,
		q,
	})
}

// Action to delete an episode.
export async function action({ request, params }: LoaderFunctionArgs<any>) {
	const formData = await request.formData()
	const intent = formData.get('intent')
	if (intent === 'delete') {
		const episodeId = formData.get('episodeId') as string
		await prisma.episode.delete({
			where: { id: episodeId },
		})
		return json({ success: true })
	}
	// Handle other intents if needed.
	return json({ success: true })
}

// Helper function to format publication date as "MM-DD-YYYY h:mm AM/PM"
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

// Helper function to format duration (in seconds) as "hh:mm:ss"
function formatDuration(seconds: number): string {
	const hrs = Math.floor(seconds / 3600)
	const mins = Math.floor((seconds % 3600) / 60)
	const secs = seconds % 60
	return [hrs, mins, secs].map((num) => String(num).padStart(2, '0')).join(':')
}

export default function PodcastEpisodes() {
	const { podcast, episodes, totalEpisodes, page, sort, q } =
		useLoaderData<LoaderData>()

	const [searchParams, setSearchParams] = useSearchParams()
	const navigation = useNavigation()
	const fetcher = useFetcher()
	const [localSearch, setLocalSearch] = useState(q)

	// Handle live search change.
	useEffect(() => {
		const timer = setTimeout(() => {
			// Update "q" parameter in URL and reset to page 1.
			const sp = new URLSearchParams(searchParams)
			sp.set('q', localSearch)
			sp.set('page', '1')
			setSearchParams(sp)
		}, 300)
		return () => clearTimeout(timer)
	}, [localSearch, searchParams, setSearchParams])

	// Toggle sort order button:
	function toggleSort() {
		const newSort = sort === 'asc' ? 'desc' : 'asc'
		const sp = new URLSearchParams(searchParams)
		sp.set('sort', newSort)
		sp.set('page', '1')
		setSearchParams(sp)
	}

	// Load More handler
	function loadMore() {
		const nextPage = page + 1
		const sp = new URLSearchParams(searchParams)
		sp.set('page', String(nextPage))
		setSearchParams(sp)
	}

	// Delete episode handler using fetcher.
	function handleDelete(episodeId: string) {
		if (confirm('Are you sure you want to delete this episode?')) {
			fetcher.submit({ episodeId, intent: 'delete' }, { method: 'post' })
		}
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-6 text-2xl font-bold">Episodes for {podcast.title}</h1>

			{/* Search and Sort Controls */}
			<div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<Input
					type="search"
					value={localSearch}
					onChange={(e) => setLocalSearch(e.target.value)}
					placeholder="Search episodes..."
					className="w-full max-w-md"
				/>
				<Button onClick={toggleSort} className="flex items-center">
					<ArrowUpDown className="mr-2 h-4 w-4" />
					Sort
				</Button>
			</div>

			{/* Episodes List */}
			{episodes.map((episode: Episode) => (
				<div key={episode.id} className="flex items-center border-b py-4">
					<div className="mr-4 flex-shrink-0">
						<img
							src="https://placehold.co/60"
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
									<Link
										to={`/podcast/${podcast.id}/episodes/${episode.id}/edit`}
									>
										Edit
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={() => handleDelete(episode.id)}>
									Delete
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link to={`#`}>Unpublish</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link to={`#`}>Share</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			))}

			{/* Load More Button */}
			{episodes.length < totalEpisodes && (
				<div className="mt-6 flex justify-center">
					<Button onClick={loadMore} disabled={navigation.state === 'loading'}>
						{navigation.state === 'loading' ? 'Loading...' : 'Load More'}
					</Button>
				</div>
			)}
		</div>
	)
}
