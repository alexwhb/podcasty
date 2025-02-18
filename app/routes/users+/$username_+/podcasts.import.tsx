import { json } from '@remix-run/server-runtime'
import fetch from 'node-fetch'
import { parseStringPromise } from 'xml2js'
import { prisma } from '#app/utils/db.server.ts'

import { requireUserId } from '#app/utils/auth.server.ts'
import { Label } from '#app/components/ui/label.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Form } from 'react-router'
import { Route } from './+types/podcasts.index'

export async function action({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const rssUrl = formData.get('rssUrl') as string

	console.log(rssUrl)

	if (!rssUrl) {
		return json({ error: 'RSS URL is required' }, { status: 400 })
	}

	try {
		// Fetch the RSS feed
		const response = await fetch(rssUrl)
		if (!response.ok) {
			throw new Error(`Failed to fetch RSS feed: ${response.statusText}`)
		}
		const rssText = await response.text()

		console.log('Prisma client:', prisma)
		if (!prisma) {
			throw new Error(
				'Prisma client is undefined. Check your import path and initialization.',
			)
		}

		// Parse the RSS feed
		const rssData = await parseStringPromise(rssText, { explicitArray: false })

		// Extract podcast-level data
		const channel = rssData.rss.channel

		const podcast = await prisma.podcast.create({
			data: {
				title: channel.title,
				description: channel.description,
				link: channel.link,
				language: channel.language || 'en',
				copyright: channel.copyright || '',
				generator: channel.generator || '',
				lastBuildDate: channel.lastBuildDate
					? new Date(channel.lastBuildDate)
					: new Date(),
				imageUrl: channel['itunes:image']?.href || '',
				author: channel['itunes:author'] || '',
				// owner: channel['itunes:owner']?.name || '',
				explicit: channel['itunes:explicit'] === 'true',
				type: channel['itunes:type'] || 'episodic',
				category: channel['itunes:category']?.text || 'Uncategorized',
				guid: channel['podcast:guid'] || '',
				locked: channel['podcast:locked'] === 'yes',
				license: channel['podcast:license'] || '',
				imageTitle: 'Default Image Title', // Default value
				imageLink: 'https://example.com/default-image-link', // Default value
				ownerId: userId,
			},
		})

		console.log(podcast)

		// Extract episode-level data
		const episodes = Array.isArray(channel.item) ? channel.item : [channel.item]
		for (const episode of episodes) {
			await prisma.episode.create({
				data: {
					title: episode.title,
					description: episode.description,
					link: episode.link,
					audioUrl: episode.enclosure?.url || '',
					audioSize: parseInt(episode.enclosure?.length || '0', 10),
					audioType: episode.enclosure?.type || 'audio/mpeg',
					guid: episode.guid?._ || episode.guid || '',
					pubDate: episode.pubDate ? new Date(episode.pubDate) : new Date(),
					duration: parseInt(episode['itunes:duration'] || '0', 10),
					episodeType: episode['itunes:episodeType'] || 'full',
					episode: parseInt(episode['itunes:episode'] || '0', 10),
					explicit: episode['itunes:explicit'] === 'ture',
					imageUrl: episode['itunes:image']?.href || '',
					transcriptUrl: episode['podcast:transcript']?.url || null,
					podcastId: podcast.id,
				},
			})
		}

		return json({ success: true, podcastId: podcast.id })
	} catch (error) {
		console.error('Error importing RSS feed:', error)
		return json({ error: error.message }, { status: 500 })
	}
}

export async function loader() {
	return json({})
}

export default function ImportPodcast() {
	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-8 text-3xl font-bold">Import Podcast from RSS</h1>
			<Form method="post" className="space-y-4">
				<div>
					<Label htmlFor="rssUrl">RSS Feed URL</Label>
					<Input
						type="url"
						name="rssUrl"
						id="rssUrl"
						placeholder="https://example.com/feed.xml"
						className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
					/>
				</div>
				<Button type="submit">Import Podcast</Button>
			</Form>
		</div>
	)
}
