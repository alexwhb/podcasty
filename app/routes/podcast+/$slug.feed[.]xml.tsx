import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import {
	getDomainUrl,
	getEpisodeImgSrc,
	getPodcastImgSrc,
} from '#app/utils/misc.tsx'
import {
	PUBLIC_EPISODE_PAGE_SIZE,
	getSinglePodcastIfOnlyOne,
} from '#app/utils/podcast-public.server.ts'

function xmlEscape(value: string | null | undefined) {
	if (!value) return ''
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

function cdata(value: string | null | undefined) {
	if (!value) return '<![CDATA[]]>'
	const safe = value.replace(/]]>/g, ']]]]><![CDATA[>')
	return `<![CDATA[${safe}]]>`
}

function imageUrl(
	image: { objectKey?: string | null; id?: string | null; updatedAt?: Date | string | null },
	origin: string,
	kind: 'podcast' | 'episode' = 'podcast',
) {
	const path =
		kind === 'podcast'
			? getPodcastImgSrc(image, image.updatedAt)
			: getEpisodeImgSrc(image)
	return absolutize(path, origin)
}

function appendPath(base: string, path: string) {
	return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function absolutize(pathOrUrl: string | null | undefined, origin: string) {
	if (!pathOrUrl) return ''
	try {
		return new URL(pathOrUrl, origin).toString()
	} catch {
		// Fallback to manual join if URL construction fails
		return pathOrUrl.startsWith('/')
			? appendPath(origin, pathOrUrl)
			: appendPath(origin, `/${pathOrUrl}`)
	}
}

function extractExtension(path: string) {
	const lastSegment = path.split('/').pop()
	if (!lastSegment) return null
	const lastDot = lastSegment.lastIndexOf('.')
	if (lastDot <= 0 || lastDot === lastSegment.length - 1) return null
	return lastSegment.slice(lastDot + 1)
}

function getExtensionFromUrl(audioUrl: string | null | undefined) {
	if (!audioUrl) return null
	try {
		return extractExtension(new URL(audioUrl, 'https://example.invalid').pathname)
	} catch {
		return extractExtension(audioUrl)
	}
}

const AUDIO_TYPE_EXTENSION_MAP: Record<string, string> = {
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/mp4': 'mp4',
	'audio/aac': 'aac',
	'audio/x-m4a': 'm4a',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/ogg': 'ogg',
	'audio/opus': 'opus',
}

function getExtensionFromAudioType(audioType: string | null | undefined) {
	if (!audioType) return null
	return AUDIO_TYPE_EXTENSION_MAP[audioType.toLowerCase()] || null
}

function buildEnclosureUrl(
	episode: {
		id: string
		audioUrl?: string | null
		audioType?: string | null
	},
	baseUrl: string | null | undefined,
	origin: string,
) {
	const extension =
		getExtensionFromUrl(episode.audioUrl) ||
		getExtensionFromAudioType(episode.audioType) ||
		'mp3'

	return absolutize(`/resources/audio/${episode.id}.${extension}`, baseUrl || origin)
}

export async function loader({
	request,
	params,
}: {
	request: Request
	params: { slug?: string; '*': string }
}) {
	const slug = params.slug ?? params['*']
	if (!slug) throw data('Podcast slug is required', { status: 400 })

	const origin = getDomainUrl(request)
	const feedUrl = new URL(request.url).toString()
	const singlePodcast = await getSinglePodcastIfOnlyOne()

	const podcast = await prisma.podcast.findUnique({
		where: { slug },
		select: {
			id: true,
			slug: true,
			title: true,
			link: true,
			description: true,
			language: true,
			copyright: true,
			generator: true,
			lastBuildDate: true,
			author: true,
			explicit: true,
			type: true,
			category: true,
			guid: true,
			locked: true,
			license: true,
			baseUrl: true,
			image: { select: { id: true, objectKey: true, updatedAt: true } },
			episodes: {
				where: { isPublished: true },
				orderBy: { pubDate: 'desc' },
				select: {
					id: true,
					title: true,
					description: true,
					link: true,
					audioUrl: true,
					audioSize: true,
					audioType: true,
					guid: true,
					pubDate: true,
					duration: true,
					episodeType: true,
					season: true,
					episode: true,
					explicit: true,
					image: { select: { id: true, objectKey: true, updatedAt: true } },
					transcript: { select: { id: true } },
				},
			},
		},
	})

	if (!podcast) throw data('Podcast not found', { status: 404 })

	const channelLink = podcast.baseUrl || podcast.link || ''
	const podcastImage =
		podcast.image && podcast.image.updatedAt
			? imageUrl(podcast.image, podcast.baseUrl || origin)
			: null

	const categories = (
		podcast.category && podcast.category !== 'Uncategorized'
			? podcast.category.split(',').map((c) => c.trim())
			: []
	).filter(Boolean)
	if (categories.length === 0) categories.push('Society & Culture')

	const categoriesXml = categories
		.map((c) => `<itunes:category text="${xmlEscape(c)}" />`)
		.join('\n\t')

	const header = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
	xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
	xmlns:podcast="https://podcastindex.org/namespace/1.0"
	xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
	<atom:link rel="self" type="application/rss+xml" href="${xmlEscape(feedUrl)}" />
	<title>${xmlEscape(podcast.title)}</title>
	<link>${xmlEscape(channelLink)}</link>
	<description>${cdata(podcast.description)}</description>
	<language>${xmlEscape(podcast.language)}</language>
	<copyright>${xmlEscape(podcast.copyright)}</copyright>
	<lastBuildDate>${new Date(podcast.lastBuildDate).toUTCString()}</lastBuildDate>
	<generator>${xmlEscape('Podcasty')}</generator>
	<itunes:author>${xmlEscape(podcast.author)}</itunes:author>
	<itunes:explicit>${podcast.explicit ? 'true' : 'false'}</itunes:explicit>
	<itunes:type>${xmlEscape(podcast.type)}</itunes:type>
	${categoriesXml}
	<itunes:owner>
		<itunes:name>${xmlEscape(podcast.author)}</itunes:name>
	</itunes:owner>
	<itunes:new-feed-url>${xmlEscape(feedUrl)}</itunes:new-feed-url>
	<podcast:locked>${podcast.locked ? 'yes' : 'no'}</podcast:locked>
	<podcast:guid>${xmlEscape(podcast.guid)}</podcast:guid>
	<podcast:license>${xmlEscape(podcast.license)}</podcast:license>
	${podcastImage ? `<itunes:image href="${xmlEscape(podcastImage)}" />` : ''}
`

	const items = podcast.episodes
		.map((episode) => {
			const desc = cdata(episode.description)
			const enclosureUrl = buildEnclosureUrl(episode, podcast.baseUrl, origin)
			const episodeImage = episode.image
				? imageUrl(episode.image, podcast.baseUrl || origin, 'episode')
				: null
			const index = podcast.episodes.findIndex((e) => e.id === episode.id)
			const pageNumber =
				index >= 0 ? Math.floor(index / PUBLIC_EPISODE_PAGE_SIZE) + 1 : 1
			const listBase =
				singlePodcast?.slug === podcast.slug
					? appendPath(origin, 'podcasts')
					: appendPath(origin, `podcasts/${podcast.slug}`)
			const itemLink = `${listBase}${pageNumber > 1 ? `?page=${pageNumber}` : ''}#${episode.id}`
			const transcriptUrl = episode.transcript?.id
				? absolutize(
						`/resources/episode-transcript/${episode.id}`,
						podcast.baseUrl || origin,
					)
				: null
			const optionalFields = [
				episode.season != null
					? `<itunes:season>${episode.season}</itunes:season>`
					: null,
				episode.episode != null
					? `<itunes:episode>${episode.episode}</itunes:episode>`
					: null,
				episode.episode != null
					? `<podcast:episode>${episode.episode}</podcast:episode>`
					: null,
				episodeImage
					? `<itunes:image href="${xmlEscape(episodeImage)}" />`
					: null,
				transcriptUrl
					? `<podcast:transcript url="${xmlEscape(transcriptUrl)}" type="application/x-subrip" />`
					: null,
			]
				.filter(Boolean)
				.map((line) => `\t${line}`)
				.join('\n')
			return `<item>
	<title>${xmlEscape(episode.title)}</title>
	<link>${xmlEscape(itemLink)}</link>
	<description>${desc}</description>
	<guid isPermaLink="false">${xmlEscape(episode.guid)}</guid>
	<pubDate>${new Date(episode.pubDate).toUTCString()}</pubDate>
	<enclosure url="${xmlEscape(enclosureUrl)}" length="${episode.audioSize || 0}" type="${xmlEscape(episode.audioType || 'audio/mpeg')}" />
	<itunes:duration>${episode.duration || 0}</itunes:duration>
	<itunes:episodeType>${xmlEscape(episode.episodeType || 'full')}</itunes:episodeType>
${optionalFields ? `${optionalFields}\n` : ''}\t<itunes:explicit>${episode.explicit ? 'true' : 'false'}</itunes:explicit>
</item>`
			})
			.join('\n')

	const rss = `${header}${items}\n</channel>\n</rss>`

	return new Response(rss, {
		status: 200,
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
		},
	})
}
