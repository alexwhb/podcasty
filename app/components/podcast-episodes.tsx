import { ArrowUpDown, Loader2Icon, PlusIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import EpisodeStatusIndicator from '#app/components/episode-status-indicator.tsx'
import { Button } from '#app/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import { Input } from '#app/components/ui/input'
import { getEpisodeImgSrc } from '#app/utils/misc.tsx'
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '#app/components/ui/dialog'
import { Textarea } from '#app/components/ui/textarea'

interface Episode {
	id: string
	title: string
	description: string
	pubDate: string
	explicit: boolean
	duration: number
	season?: number
	isPublished: boolean
	number?: number
	image?: { id?: string; objectKey?: string }
	transcript?: { id: string } | null
}

interface Podcast {
	id: string
	title: string
	image?: { id?: string; objectKey?: string }
	episodes: Episode[]
}

interface PodcastEpisodesProps {
	podcast: Podcast
	episodes: Episode[]
	totalEpisodes: number
	onSearch: (query: string) => void
	onSortToggle: (newSort: 'asc' | 'desc') => void
	onLoadMore: () => void
	onDeleteDialogOpen: (episode: { id: string; title: string }) => void
	onPublishUnpublish: (episodeId: string, isPublished: boolean) => void
	currentSort: 'asc' | 'desc'
	isLoading: boolean
	// For search field styling and clear functionality.
	localSearch: string
	setLocalSearch: React.Dispatch<React.SetStateAction<string>>
	clearSearch: () => void
	isWhisperConfigured?: boolean
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
	onDeleteDialogOpen,
	currentSort,
	isLoading,
	onPublishUnpublish,
	localSearch,
	setLocalSearch,
	clearSearch,
	isWhisperConfigured = false,
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

	const transcriptFetcher = useFetcher<{ transcript?: string }>()
	const [transcriptModal, setTranscriptModal] = useState<{
		open: boolean
		episode: Episode | null
	}>({ open: false, episode: null })

	const [draftTranscript, setDraftTranscript] = useState('')
	const [generateState, setGenerateState] = useState<
		'idle' | 'pending' | 'error'
	>('idle')
	const [generateError, setGenerateError] = useState<string | null>(null)

	const openTranscriptModal = (episode: Episode) => {
		setTranscriptModal({ open: true, episode })
		setDraftTranscript('')
		if (episode.transcript?.id) {
			transcriptFetcher.load(`/resources/episode-transcript/${episode.id}`)
		}
	}

	useEffect(() => {
		if (transcriptFetcher.data?.transcript !== undefined) {
			setDraftTranscript(transcriptFetcher.data.transcript)
		}
	}, [transcriptFetcher.data])

	const hasTranscript = useMemo(
		() => Boolean(transcriptModal.episode?.transcript?.id),
		[transcriptModal.episode],
	)

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
							src={
								episode.image
									? getEpisodeImgSrc(episode.image)
									: 'https://placehold.co/60'
							}
							alt="Episode Thumbnail"
							width={60}
							height={60}
							className="rounded-md object-cover"
						/>
					</div>
					<div className="flex-grow">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<h2 className="text-lg font-bold">
									<Link
										to={`./episode/${episode.id}/edit`}
										prefetch="intent"
										className="hover:underline"
									>
										{episode.title}
									</Link>
								</h2>
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
					{episode.isPublished ? (
						<EpisodeStatusIndicator variant="green" title="Live Now" />
					) : (
						<EpisodeStatusIndicator variant="red" title="Draft" />
					)}

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
								<DropdownMenuItem onSelect={(e) => {
									e.preventDefault()
									onDeleteDialogOpen({
										id: episode.id,
										title: episode.title
									})
								}}>
									Delete
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => onPublishUnpublish(episode.id, !episode.isPublished)}
								>
									{episode.isPublished ? (
										<>Unpublish</>
									) : (
										<>Publish</>
									)}
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={(e) => {
										e.preventDefault()
										openTranscriptModal(episode)
									}}
								>
									{episode.transcript ? 'View Transcript' : 'Add Transcript'}
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

			{transcriptModal.open ? (
				<Dialog
					open={transcriptModal.open}
					onOpenChange={(open) =>
						setTranscriptModal((prev) => ({ ...prev, open }))
					}
				>
					<DialogContent className="max-w-3xl">
						<DialogHeader>
							<DialogTitle>
								{hasTranscript ? 'Transcript' : 'Add transcript'}
							</DialogTitle>
						</DialogHeader>

						{!hasTranscript && draftTranscript === '' ? (
							<div className="space-y-3">
								<p className="text-sm text-muted-foreground">
									No transcript yet. Choose an option:
								</p>
								<div className="flex flex-wrap gap-3">
									<Button
										variant="secondary"
										disabled={!isWhisperConfigured || generateState === 'pending'}
										onClick={async () => {
											if (!transcriptModal.episode) return
											setGenerateError(null)
											setGenerateState('pending')
											const formData = new FormData()
											formData.set('intent', 'generate')
											try {
												const response = await fetch(
													`/resources/episode-transcript-generate/${transcriptModal.episode.id}`,
													{
														method: 'post',
													},
												)
												const result = await response.json()
												if (!response.ok || !result.success) {
													throw new Error(result.error || 'Failed to generate')
												}
												setDraftTranscript(result.transcript || '')
												setGenerateState('idle')
											} catch (error) {
												console.error(error)
												setGenerateError(
													error instanceof Error
														? error.message
														: 'Failed to generate transcript',
												)
												setGenerateState('error')
											}
										}}
									>
										{generateState === 'pending' ? (
											<>
												<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
												Generating...
											</>
										) : (
											'Auto-generate (Whisper)'
										)}
									</Button>
									<Button
										variant="outline"
										onClick={() => setDraftTranscript('')}
									>
										Add manually
									</Button>
								</div>
										{!isWhisperConfigured ? (
									<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
										<p className="font-semibold">Whisper not configured</p>
										<p>
											Set WHISPER_ENDPOINT for a local Whisper server, or set
											OPENAI_API_KEY and ENABLE_WHISPER=true to use OpenAI.
										</p>
									</div>
								) : null}
								{generateError ? (
									<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
										<p className="font-semibold">Generation failed</p>
										<p>{generateError}</p>
									</div>
								) : null}
							</div>
						) : null}

						{hasTranscript || draftTranscript !== '' ? (
							<div className="space-y-2">
								<label className="text-sm font-medium">Transcript</label>
								<Textarea
									value={draftTranscript}
									onChange={(e) => setDraftTranscript(e.target.value)}
									rows={12}
									className="w-full"
									placeholder="Paste or type transcript here..."
								/>
							</div>
						) : null}

						<DialogFooter className="flex items-center justify-between">
							{hasTranscript ? (
								<Button
									variant="ghost"
									className="text-destructive"
									onClick={() => {
										if (!transcriptModal.episode) return
										transcriptFetcher.submit(
											{},
											{
												method: 'delete',
												action: `/resources/episode-transcript/${transcriptModal.episode.id}`,
											},
										)
										setDraftTranscript('')
										setTranscriptModal((prev) => ({ ...prev, open: false }))
									}}
									title="Delete transcript"
								>
									🗑
								</Button>
							) : (
								<span />
							)}

							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() =>
										setTranscriptModal({ open: false, episode: null })
									}
								>
									Close
								</Button>
								{(hasTranscript || draftTranscript) && (
									<Button
										onClick={() => {
											if (!transcriptModal.episode) return
											const formData = new FormData()
											formData.set('transcript', draftTranscript)
											transcriptFetcher.submit(formData, {
												method: 'post',
												action: `/resources/episode-transcript/${transcriptModal.episode.id}`,
											})
											setTranscriptModal((prev) => ({ ...prev, open: false }))
										}}
									>
										Save
									</Button>
								)}
							</div>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	)
}
