import { PencilIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useFetcher, useLoaderData, useSearchParams } from 'react-router'
import PodcastEpisodes from '#app/components/podcast-episodes' // Import the PodcastEpisodes component
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getPodcastImgSrc } from '#app/utils/misc.tsx'
import { type Route } from './+types/podcasts.$podcastId'
import DeleteDialog from '#app/components/delete-dialog.tsx'

const PAGE_SIZE = 10

export async function loader({ params, request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)

	// Extract query parameters.
	const searchQuery = url.searchParams.get('search') || ''
	const sort = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc'
	const page = parseInt(url.searchParams.get('page') || '1', 10)

	// Fetch the podcast.
	const podcast = await prisma.podcast.findUnique({
		where: { id: params.podcastId, ownerId: userId },
		select: {
			id: true,
			title: true,
			author: true,
			description: true,
			createdAt: true,
			image: { select: { id: true, updatedAt: true } },
		},
	})

	if (!podcast) {
		throw new Response('Podcast not found', { status: 404 })
	}

	// Fetch the episodes for the podcast.
	const episodes = await prisma.episode.findMany({
		where: {
			podcastId: params.podcastId,
			title: { contains: searchQuery },
		},
		select: {
			id: true,
			title: true,
			pubDate: true,
			duration: true,
			season: true,
			episode: true,
			isPublished: true,
			image: { select: { id: true, updatedAt: true } },
		},
		orderBy: { pubDate: sort },
		skip: (page - 1) * PAGE_SIZE,
		take: PAGE_SIZE,
	})

	// Count the total number of episodes.
	const totalEpisodes = await prisma.episode.count({
		where: {
			podcastId: params.podcastId,
			title: { contains: searchQuery },
		},
	})

	return {
		podcast,
		episodes,
		totalEpisodes,
		currentPage: page,
		currentSort: sort,
		searchQuery,
	}
}

export async function action({ params, request }: Route.ActionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === 'delete') {
		const episodeId = formData.get('episodeId') as string

		// Ensure the user owns the podcast before deleting
		const podcast = await prisma.podcast.findUnique({
			where: { id: params.podcastId, ownerId: userId },
		})

		if (!podcast) {
			throw new Response('Podcast not found', { status: 404 })
		}

		await prisma.episode.delete({
			where: { id: episodeId },
		})

		return null
	} else if (intent === 'publish') {
		const episodeId = formData.get('episodeId') as string
		const isPublished = formData.get('isPublished') === 'true'
		await prisma.episode.update({
			where: { id: episodeId },
			data: { isPublished: isPublished },
		})
		return null
	}

	throw new Response('Invalid action', { status: 400 })
}

export default function PodcastInfo() {
	const {
		podcast,
		episodes: loaderEpisodes,
		totalEpisodes,
		currentPage,
		currentSort,
		searchQuery,
	} = useLoaderData<typeof loader>()

	// Maintain a local episode list that appends new episodes
	// when "Load More" is invoked.
	const [episodeList, setEpisodeList] = useState(loaderEpisodes)

	// We'll also keep a local search value for the input field.
	const [localSearch, setLocalSearch] = useState(searchQuery)

	const [searchParams, setSearchParams] = useSearchParams()
	const fetcher = useFetcher()

	// Add delete dialog state
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [episodeToDelete, setEpisodeToDelete] = useState<{id: string, title: string} | null>(null)

	// Whenever the loader returns new episodes, update our local list.
	// When currentPage is 1 (i.e. a new search or sort occurred) we reset;
	// Otherwise, we append.
	useEffect(() => {
		if (currentPage === 1) {
			setEpisodeList(loaderEpisodes)
		} else {
			setEpisodeList((prev) => [...prev, ...loaderEpisodes])
		}
	}, [loaderEpisodes, currentPage])

	// Helper: update URL search parameters.
	const updateSearchParams = useCallback(
		(newParams: Record<string, string | number>) => {
			const params = new URLSearchParams(searchParams)
			Object.entries(newParams).forEach(([key, value]) => {
				if (value === undefined || value === null || value === '') {
					params.delete(key)
				} else {
					params.set(key, String(value))
				}
			})
			setSearchParams(params)
		},
		[searchParams, setSearchParams],
	)

	// Memoized handler: update search param (and reset page) only if value changes.
	const handleSearch = useCallback(
		(query: string) => {
			// Only update if the incoming value differs from what is currently in the URL.
			if (query !== searchQuery) {
				updateSearchParams({ search: query, page: 1 })
			}
		},
		[searchQuery, updateSearchParams],
	)

	// Memoized handler: toggle sort order and reset page.
	const handleSortToggle = useCallback(
		(newSort: 'asc' | 'desc') => {
			updateSearchParams({ sort: newSort, page: 1 })
		},
		[updateSearchParams],
	)

	// Memoized handler: increment page for loading more episodes.
	const handleLoadMore = useCallback(() => {
		updateSearchParams({ page: currentPage + 1 })
	}, [currentPage, updateSearchParams])

	// Memoized delete handler using fetcher to submit a form.
	const handleDeleteEpisode = useCallback(
		async (episodeId: string) => {
			const formData = new FormData()
			formData.set('intent', 'delete')
			formData.set('episodeId', episodeId)
			await fetcher.submit(formData, { method: 'post' })
		},
		[fetcher],
	)

	const onPublishUnpublish = useCallback(
		async (episodeId: string, isPublished: boolean) => {
			const formData = new FormData()
			formData.set('intent', 'publish')
			formData.set('episodeId', episodeId)
			formData.set('isPublished', String(isPublished))
			await fetcher.submit(formData, { method: 'post' })
		},
		[fetcher],
	)

	// When the clear button is clicked, clear the local search state
	// and update the URL.
	const clearSearch = useCallback(() => {
		setLocalSearch('')
		handleSearch('')
	}, [handleSearch])

	// Memoized delete handlers
	const handleDeleteDialogOpen = useCallback((episode: {id: string, title: string}) => {
		setEpisodeToDelete(episode)
		setDeleteDialogOpen(true)
	}, [])

	const handleDeleteConfirm = useCallback(async () => {
		if (!episodeToDelete) return
		
		await handleDeleteEpisode(episodeToDelete.id)
		setEpisodeToDelete(null)
		setDeleteDialogOpen(false)
	}, [episodeToDelete, handleDeleteEpisode])

	return (
		<div className="mx-auto w-full max-w-4xl overflow-y-auto p-6">
			{/* Main content */}
			<div className="mt-4 flex flex-col gap-6 md:flex-row">
				<div className="w-full md:w-1/3">
					<img
						src={
							podcast?.image?.id
								? getPodcastImgSrc(
										podcast?.image?.id,
										podcast?.image?.updatedAt,
									)
								: 'https://placehold.co/300'
						}
						alt="Podcast Cover"
						width={250}
						height={250}
						className="h-[250px] w-full overflow-hidden rounded-lg object-cover shadow-lg"
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
						dangerouslySetInnerHTML={{
							__html: podcast?.description || 'N/A',
						}}
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
			<Spacer size="md" />
			{/* Podcast Episodes Component */}
			<PodcastEpisodes
				podcast={podcast}
				episodes={episodeList}
				totalEpisodes={totalEpisodes}
				onPublishUnpublish={onPublishUnpublish}
				onSearch={handleSearch}
				onSortToggle={handleSortToggle}
				onLoadMore={handleLoadMore}
				onDeleteDialogOpen={handleDeleteDialogOpen}
				currentPage={currentPage}
				currentSort={currentSort}
				isLoading={fetcher.state === 'submitting'}
				localSearch={localSearch}
				setLocalSearch={setLocalSearch}
				clearSearch={clearSearch}
				currentSearch={searchQuery}
			/>

			{/* Delete Dialog */}
			{episodeToDelete && (
				<DeleteDialog 
					verificationString={episodeToDelete.title}
					placeholder="Enter episode title"
					isOpen={deleteDialogOpen}
					onOpenChange={setDeleteDialogOpen}
					onDelete={handleDeleteConfirm}
				/>
			)}
		</div>
	)
}
