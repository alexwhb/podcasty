import { Link, useSearchParams } from 'react-router'
import { useState } from 'react'
import { Calendar, Clock, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#app/components/ui/button.tsx'
import { getEpisodeImgSrc, getPodcastImgSrc } from '#app/utils/misc.tsx'
import { type PublicPodcastData } from '#app/utils/podcast-public.server.ts'

function formatPubDate(dateString: string) {
	return new Date(dateString).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

function formatDuration(seconds: number) {
	const hrs = Math.floor(seconds / 3600)
	const mins = Math.floor((seconds % 3600) / 60)
	const secs = seconds % 60
	return [hrs, mins, secs].map((num) => String(num).padStart(2, '0')).join(':')
}

export function PublicPodcastPage({ data }: { data: PublicPodcastData }) {
	const { podcast, episodes, totalEpisodes, page, pageSize, rssUrl } = data
	const [searchParams] = useSearchParams()
	const [expandedDescriptions, setExpandedDescriptions] = useState<
		Record<string, boolean>
	>({})
	const totalPages = Math.max(1, Math.ceil(totalEpisodes / pageSize))
	const rangeStart =
		totalEpisodes === 0 ? 0 : (page - 1) * pageSize + 1
	const rangeEnd =
		totalEpisodes === 0 ? 0 : Math.min(page * pageSize, totalEpisodes)

	const setPageParam = (newPage: number) => {
		const params = new URLSearchParams(searchParams)
		params.set('page', String(newPage))
		return `?${params.toString()}`
	}

	const handleCopyRss = async () => {
		try {
			await navigator.clipboard.writeText(rssUrl)
			toast.success('RSS link copied')
		} catch (error) {
			console.error(error)
			toast.error('Could not copy RSS link')
		}
	}

	const handleShare = async () => {
		const shareUrl = window.location.href
		try {
			if (navigator.share) {
				await navigator.share({
					title: podcast.title,
					text: podcast.description,
					url: shareUrl,
				})
			} else {
				await navigator.clipboard.writeText(shareUrl)
				toast.success('Link copied to clipboard')
			}
		} catch (error) {
			console.error(error)
			toast.error('Could not share link')
		}
	}

	return (
		<div className="mx-auto w-full max-w-4xl p-6 pb-16">
			<section className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-sm md:flex-row md:items-start">
				<div className="w-fit">
					<img
						src={
							podcast.image
								? getPodcastImgSrc(podcast.image, podcast.image?.updatedAt)
								: 'https://placehold.co/200?text=Podcast'
						}
						alt={podcast.title}
						className="h-28 w-28 rounded-lg object-cover shadow-sm"
					/>
				</div>

				<div className="flex-1 space-y-3">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-3xl font-bold leading-tight md:text-4xl">
							{podcast.title}
						</h1>
					</div>
					<p className="text-base text-muted-foreground">
						Created by <span className="font-semibold">{podcast.author}</span>
					</p>
					<div
						className="prose max-w-none text-sm leading-relaxed text-muted-foreground dark:prose-invert"
						dangerouslySetInnerHTML={{ __html: podcast.description }}
					/>

					<div className="flex flex-wrap gap-3 pt-2">
						<Button onClick={handleCopyRss} variant="outline" size="sm">
							Copy RSS
						</Button>
						<Button onClick={handleShare} variant="secondary" size="sm">
							<Share2 className="h-4 w-4" />
							<span className="ml-2">Share</span>
						</Button>
					</div>
				</div>
			</section>

			<section className="mt-10 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-2xl font-semibold">Episodes</h2>
					<p className="text-sm text-muted-foreground">
						Showing {rangeStart}-{rangeEnd} of {totalEpisodes}
					</p>
				</div>

				<div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
					{episodes.length === 0 ? (
						<p className="text-muted-foreground">No episodes published yet.</p>
					) : (
						episodes.map((episode) => (
							<article
								id={episode.id}
								key={episode.id}
								className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start"
							>
								<div className="mr-3 flex-shrink-0">
									<img
										src={
											episode.image
												? getEpisodeImgSrc(episode.image)
												: 'https://placehold.co/120?text=Episode'
										}
										alt={episode.title}
										className="h-16 w-16 rounded-md object-cover"
									/>
								</div>
								<div className="flex flex-1 flex-col gap-2">
									<div className="flex flex-wrap items-center gap-2">
										<h3 className="text-lg font-semibold leading-tight">
											{episode.title}
										</h3>
										{episode.explicit ? (
											<span className="rounded-full bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive">
												Explicit
											</span>
										) : null}
										{episode.episode != null ? (
											<span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
												{episode.season != null
													? `S${episode.season} • E${episode.episode}`
													: `E${episode.episode}`}
											</span>
										) : null}
									</div>
									<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
										<span className="inline-flex items-center gap-1">
											<Calendar className="h-4 w-4" />
											{formatPubDate(episode.pubDate)}
										</span>
										<span className="inline-flex items-center gap-1">
											<Clock className="h-4 w-4" />
											{formatDuration(episode.duration)}
										</span>
									</div>
									{episode.description ? (
										<div className="space-y-2">
											<div
												className={`prose max-w-none text-sm text-muted-foreground dark:prose-invert ${
													expandedDescriptions[episode.id] ? '' : 'line-clamp-3'
												}`}
												dangerouslySetInnerHTML={{ __html: episode.description }}
											/>
											{(episode.description.length ?? 0) > 200 ? (
												<button
													type="button"
													className="text-sm font-medium text-primary underline-offset-4 hover:underline"
													onClick={() =>
														setExpandedDescriptions((prev) => ({
															...prev,
															[episode.id]: !prev[episode.id],
														}))
													}
												>
													{expandedDescriptions[episode.id] ? 'Show less' : 'Show more'}
												</button>
											) : null}
										</div>
									) : null}
									{episode.audioUrl ? (
										<audio
											controls
											preload="none"
											src={`/resources/audio/${episode.id}`}
											className="w-full max-w-md rounded-md"
										/>
									) : (
										<span className="text-sm text-muted-foreground">
											No audio available for playback.
										</span>
									)}
								</div>
							</article>
						))
					)}
				</div>

				{totalPages > 1 ? (
					<div className="flex items-center justify-between gap-3">
						<Button variant="outline" disabled={page <= 1} asChild>
							<Link to={setPageParam(page - 1)}>Previous</Link>
						</Button>
						<p className="text-sm text-muted-foreground">
							Page {page} of {totalPages}
						</p>
						<Button variant="outline" disabled={page >= totalPages} asChild>
							<Link to={setPageParam(page + 1)}>Next</Link>
						</Button>
					</div>
				) : null}
			</section>
		</div>
	)
}
