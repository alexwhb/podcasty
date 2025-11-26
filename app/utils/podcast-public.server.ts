import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { getDomainUrl } from '#app/utils/misc.tsx'

export const PUBLIC_EPISODE_PAGE_SIZE = 15

export async function getSinglePodcastIfOnlyOne() {
	const [count, podcast] = await prisma.$transaction([
		prisma.podcast.count(),
		prisma.podcast.findFirst({
			orderBy: { createdAt: 'asc' },
			select: { slug: true },
		}),
	])

	if (count === 1 && podcast) {
		return podcast
	}

	return null
}

export async function loadPublicPodcast({
	request,
	slug,
}: {
	request: Request
	slug: string
}) {
	if (!slug) throw data('Podcast slug is required', { status: 400 })

	const url = new URL(request.url)
	const pageParam = Number(url.searchParams.get('page') || '1')
	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

	const podcast = await prisma.podcast.findUnique({
		where: { slug },
		select: {
			id: true,
			slug: true,
			title: true,
			description: true,
			author: true,
			image: { select: { id: true, objectKey: true, updatedAt: true } },
		},
	})

	if (!podcast) {
		throw data('Podcast not found', { status: 404 })
	}

	const [episodes, totalEpisodes] = await prisma.$transaction([
		prisma.episode.findMany({
			where: { podcastId: podcast.id, isPublished: true },
			orderBy: { pubDate: 'desc' },
			select: {
				id: true,
				title: true,
				description: true,
				pubDate: true,
				duration: true,
				season: true,
				episode: true,
				explicit: true,
				audioUrl: true,
				audioType: true,
				image: { select: { id: true, objectKey: true, updatedAt: true } },
			},
			skip: (page - 1) * PUBLIC_EPISODE_PAGE_SIZE,
			take: PUBLIC_EPISODE_PAGE_SIZE,
		}),
		prisma.episode.count({
			where: { podcastId: podcast.id, isPublished: true },
		}),
	])

	const rssUrl = `${getDomainUrl(request)}/podcast/${podcast.slug}/feed.xml`

	return {
		podcast,
		episodes,
		totalEpisodes,
		page,
		pageSize: PUBLIC_EPISODE_PAGE_SIZE,
		rssUrl,
	}
}

export type PublicPodcastData = Awaited<ReturnType<typeof loadPublicPodcast>>
