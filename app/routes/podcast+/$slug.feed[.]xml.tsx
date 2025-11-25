import { data } from 'react-router'
import { prisma } from '#app/utils/db.server.ts'
import { getPodcastImgSrc } from '#app/utils/misc.tsx'

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

export async function loader({ params }: { params: { slug?: string; '*': string } }) {
	const slug = params.slug ?? params['*']
	if (!slug) throw data('Podcast slug is required', { status: 400 })

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
			image: { select: { id: true, updatedAt: true } },
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
		podcast.image?.id && podcast.image.updatedAt
			? getPodcastImgSrc(podcast.image.id, podcast.image.updatedAt)
			: null

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
	<itunes:category>${xmlEscape(podcast.category)}</itunes:category>
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
			return `<item>
	<title>${xmlEscape(episode.title)}</title>
	<link>${xmlEscape(itemLink)}</link>
	<description>${desc}</description>
	<guid isPermaLink="false">${xmlEscape(episode.guid)}</guid>
	<pubDate>${new Date(episode.pubDate).toUTCString()}</pubDate>
	<enclosure url="${xmlEscape(episode.audioUrl || '')}" length="${episode.audioSize || 0}" type="${xmlEscape(episode.audioType || 'audio/mpeg')}" />
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
