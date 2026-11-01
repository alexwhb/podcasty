import fs from 'node:fs/promises'
import path from 'node:path'
import { decode } from 'he'
import { parseStringPromise } from 'xml2js'
import fetch from 'node-fetch'
import { parseBuffer } from 'music-metadata'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { ensureUniquePodcastSlug } from '#app/utils/slug.server.ts'
import {
	uploadEpisodeImage,
	uploadPodcastImage,
} from '#app/utils/storage.server.ts'

export const ImportPodcastSchema = z.object({
	rssUrl: z.string().url('Please enter a valid URL'),
	importImages: z.boolean().default(false),
	importEpisodes: z.boolean().default(false),
	importTranscripts: z.boolean().default(false),
})

export const ImportJobPayloadSchema = ImportPodcastSchema.extend({
	userId: z.string(),
})

async function downloadAndConvertToBlob(url: string) {
	try {
		const response = await fetch(url)
		if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`)

		const arrayBuffer = await response.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)
		const contentType =
			response.headers.get('content-type') || 'application/octet-stream'
		const fileName = (() => {
			try {
				const parsed = new URL(url)
				const parts = parsed.pathname.split('/').filter(Boolean)
				return parts[parts.length - 1] || 'file'
			} catch {
				return 'file'
			}
		})()

		// URLs like /resources/images?objectKey=... have no extension in the
		// path, which ended up as the stored key's extension (".images").
		const extensions: Record<string, string> = {
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/webp': 'webp',
		}
		const extension = extensions[contentType.split(';')[0]?.trim() ?? '']
		const namedFile =
			extension && !/\.[A-Za-z0-9]{2,5}$/.test(fileName)
				? `${fileName}.${extension}`
				: fileName

		return { buffer, contentType, fileName: namedFile }
	} catch (error) {
		console.error('Error downloading file:', error)
		return null
	}
}

function extractCategories(channel: any): Array<string> {
	const raw = channel['itunes:category']
	if (!raw) return []
	const list = Array.isArray(raw) ? raw : [raw]
	return list
		.map((entry: any) =>
			typeof entry === 'string' ? entry : entry?.$?.text ?? '',
		)
		.filter((c: string) => c.trim().length)
		.map((c: string) => c.trim())
}

// Imported audio is stored on local disk, like uploaded audio, because the
// audio route serves /uploads/audio/... paths. (S3 copies were stored as
// s3:// URLs that nothing could serve.)
const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio')

function parseExplicit(value: unknown) {
	return value === 'true' || value === 'yes'
}

function parseOptionalInt(value: unknown) {
	const parsed = Number.parseInt(String(value ?? ''), 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// itunes:duration is either seconds or [[HH:]MM:]SS.
function parseDuration(value: unknown) {
	const parts = String(value ?? '').trim().split(':').map(Number)
	if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0
	return Math.round(parts.reduce((total, part) => total * 60 + part, 0))
}

async function storeAudioFile({
	podcastId,
	episodeId,
	audioUrl,
}: {
	podcastId: string
	episodeId: string
	audioUrl: string
}) {
	try {
		const res = await fetch(audioUrl)
		if (!res.ok || !res.body)
			throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`)
		const arrayBuffer = await res.arrayBuffer()
		const buffer = Buffer.from(arrayBuffer)
		const contentType = res.headers.get('content-type') ?? 'audio/mpeg'
		const fileNameFromUrl = (() => {
			try {
				const parsed = new URL(audioUrl)
				const parts = parsed.pathname.split('/').filter(Boolean)
				return parts[parts.length - 1] || 'audio.mp3'
			} catch {
				return 'audio.mp3'
			}
		})()
		// The name comes from a remote URL, so keep it to safe characters.
		const safeName = fileNameFromUrl.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^\.+/, '')
		const storageKey = `${podcastId}/${safeName || 'audio.mp3'}`

		const target = path.join(AUDIO_DIR, storageKey)
		await fs.mkdir(path.dirname(target), { recursive: true })
		await fs.writeFile(target, buffer)
		const publicUrl = `/uploads/audio/${storageKey}`

		// Try to read duration/format
		let duration = 0
		try {
			const meta = await parseBuffer(buffer, fileNameFromUrl, {
				duration: true,
			})
			duration = Math.round(meta.format.duration ?? 0)
		} catch (err) {
			console.warn('Failed to parse audio metadata', err)
		}

		await prisma.episode.update({
			where: { id: episodeId },
			data: {
				audioUrl: publicUrl,
				audioSize: buffer.length,
				audioType: contentType,
				duration,
			},
		})
	} catch (err) {
		console.error(`Audio download failed for episode ${episodeId}`, err)
	}
}

export async function importPodcastFromRss({
	rssUrl,
	importImages,
	importEpisodes,
	importTranscripts,
	userId,
}: z.infer<typeof ImportJobPayloadSchema>) {
	const response = await fetch(rssUrl)
	if (!response.ok) {
		throw new Error(`Failed to fetch RSS feed: ${response.statusText}`)
	}
	const rssText = await response.text()
	const rssData = await parseStringPromise(rssText, { explicitArray: false })
	const channel = rssData.rss.channel
	const categories = extractCategories(channel)

	const slug = await ensureUniquePodcastSlug(channel.title || 'podcast')
	const podcast = await prisma.podcast.create({
		data: {
			slug,
			title: decode(channel.title || ''),
			description: decode(channel.description || ''),
			link: channel.link,
			language: channel.language || 'en',
			copyright: channel.copyright || '',
			generator: channel.generator || '',
			lastBuildDate: channel.lastBuildDate
				? new Date(channel.lastBuildDate)
				: new Date(),
			author: channel['itunes:author'] || '',
			explicit: parseExplicit(channel['itunes:explicit']),
			type: channel['itunes:type'] || 'episodic',
			category: categories.length ? categories.join(',') : 'Uncategorized',
			guid: channel['podcast:guid'] || '',
			locked: channel['podcast:locked'] === 'yes',
			license: channel['podcast:license'] || '',
			baseUrl: channel.link || '',
			ownerId: userId,
		},
	})

	if (importImages && channel['itunes:image']?.$?.href) {
		const imageData = await downloadAndConvertToBlob(channel['itunes:image'].$.href)
		if (imageData) {
			const file = new File([imageData.buffer], imageData.fileName, {
				type: imageData.contentType,
			})
			const objectKey = await uploadPodcastImage(userId, podcast.id, file)
			await prisma.podcast.update({
				where: { id: podcast.id },
				data: {
					image: {
						create: {
							objectKey,
							contentType: imageData.contentType,
						},
					},
				},
			})
		}
	}

	if (importEpisodes) {
		const episodes = Array.isArray(channel.item) ? channel.item : [channel.item]
		for (const episode of episodes) {
			const enclosureUrl =
				episode.enclosure?.url ?? episode.enclosure?.$?.url ?? ''
			const enclosureLength =
				episode.enclosure?.length ?? episode.enclosure?.$?.length ?? '0'
			const enclosureType =
				episode.enclosure?.type ?? episode.enclosure?.$?.type ?? 'audio/mpeg'

			let episodeImageFile: File | null = null
			if (importImages && episode['itunes:image']?.$?.href) {
				const imageData = await downloadAndConvertToBlob(
					episode['itunes:image']?.$?.href,
				)
				if (imageData) {
					episodeImageFile = new File([imageData.buffer], imageData.fileName, {
						type: imageData.contentType,
					})
				}
			}

			let transcriptBlob = undefined

			if (importTranscripts && episode['podcast:transcript']?.$?.url) {
				const transcriptData = await downloadAndConvertToBlob(
					episode['podcast:transcript']?.$?.url,
				)

				if (transcriptData) {
					transcriptBlob = {
						create: {
							contentType: transcriptData.contentType,
							blob: transcriptData.buffer,
						},
					}
				}
			}

			const createdEpisode = await prisma.episode.create({
				data: {
					title: decode(episode.title || ''),
					description: decode(episode.description || ''),
					link: episode.link,
					audioUrl: enclosureUrl || '',
					audioSize: parseInt(enclosureLength, 10),
					audioType: enclosureType,
					guid: episode.guid?._ || episode.guid || '',
					pubDate: episode.pubDate ? new Date(episode.pubDate) : new Date(),
					duration: parseDuration(episode['itunes:duration']),
					episodeType: episode['itunes:episodeType'] || 'full',
					episode: parseOptionalInt(episode['itunes:episode']),
					season: parseOptionalInt(episode['itunes:season']),
					explicit: parseExplicit(episode['itunes:explicit']),
					podcastId: podcast.id,
					transcript: transcriptBlob,
				},
			})

			if (episodeImageFile) {
				const objectKey = await uploadEpisodeImage(
					userId,
					podcast.id,
					createdEpisode.id,
					episodeImageFile,
				)
				await prisma.episode.update({
					where: { id: createdEpisode.id },
					data: {
						image: {
							create: {
								objectKey,
								contentType: episodeImageFile.type,
							},
						},
					},
				})
			}

			if (enclosureUrl) {
				void storeAudioFile({
					podcastId: podcast.id,
					episodeId: createdEpisode.id,
					audioUrl: enclosureUrl,
				})
			}
		}
	}

	return { podcastId: podcast.id }
}
