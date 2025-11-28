import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { getDomainUrl, getPodcastImgSrc } from '#app/utils/misc.tsx'

function xmlEscape(value: string | null | undefined) {
	if (!value) return ''
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
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
				},
			},
		},
	})

	if (!podcast) throw data('Podcast not found', { status: 404 })

	const channelLink = podcast.baseUrl || podcast.link || ''
	const podcastImage =
		podcast.image && podcast.image.updatedAt
			? absolutize(
					getPodcastImgSrc(podcast.image, podcast.image.updatedAt),
					podcast.baseUrl || origin,
				)
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
	xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
	<title>${xmlEscape(podcast.title)}</title>
	<link>${xmlEscape(channelLink)}</link>
	<description>${xmlEscape(podcast.description)}</description>
	<language>${xmlEscape(podcast.language)}</language>
	<copyright>${xmlEscape(podcast.copyright)}</copyright>
	<lastBuildDate>${new Date(podcast.lastBuildDate).toUTCString()}</lastBuildDate>
	<generator>${xmlEscape('Podcasty')}</generator>
	<itunes:author>${xmlEscape(podcast.author)}</itunes:author>
	<itunes:explicit>${podcast.explicit ? 'yes' : 'no'}</itunes:explicit>
	<itunes:type>${xmlEscape(podcast.type)}</itunes:type>
	${categoriesXml}
	<itunes:owner>
		<itunes:name>${xmlEscape(podcast.author)}</itunes:name>
	</itunes:owner>
	<podcast:locked>${podcast.locked ? 'yes' : 'no'}</podcast:locked>
	<podcast:guid>${xmlEscape(podcast.guid)}</podcast:guid>
	<podcast:license>${xmlEscape(podcast.license)}</podcast:license>
	${podcastImage ? `<itunes:image href="${xmlEscape(podcastImage)}" />` : ''}
`

	const items = podcast.episodes
		.map((episode) => {
			const itemLink = podcast.baseUrl
				? appendPath(podcast.baseUrl, `episodes/${episode.id}`)
				: episode.link || ''
			const desc = xmlEscape(episode.description)
			const enclosureUrl = absolutize(
				episode.audioUrl || '',
				podcast.baseUrl || origin,
			)
			return `<item>
	<title>${xmlEscape(episode.title)}</title>
	<link>${xmlEscape(itemLink)}</link>
	<description>${desc}</description>
	<guid isPermaLink="false">${xmlEscape(episode.guid)}</guid>
	<pubDate>${new Date(episode.pubDate).toUTCString()}</pubDate>
	<enclosure url="${xmlEscape(enclosureUrl)}" length="${episode.audioSize || 0}" type="${xmlEscape(episode.audioType || 'audio/mpeg')}" />
	<itunes:duration>${episode.duration || 0}</itunes:duration>
	<itunes:episodeType>${xmlEscape(episode.episodeType || 'full')}</itunes:episodeType>
	${episode.season != null ? `<itunes:season>${episode.season}</itunes:season>` : ''}
	${episode.episode != null ? `<itunes:episode>${episode.episode}</itunes:episode>` : ''}
	<itunes:explicit>${episode.explicit ? 'yes' : 'no'}</itunes:explicit>
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
