import fs from 'node:fs/promises'
import path from 'node:path'
import { decode } from 'he'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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

		return { buffer, contentType, fileName }
	} catch (error) {
		console.error('Error downloading file:', error)
		return null
	}
}

type StorageConfig =
	| { kind: 's3'; client: S3Client; bucket: string; publicBaseUrl?: string }
	| { kind: 'fs'; baseDir: string; publicBaseUrl?: string }

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

function createStorageConfig(): StorageConfig {
	if (process.env.USE_S3 === 'true') {
		if (
			!process.env.S3_BUCKET ||
			!process.env.AWS_ACCESS_KEY_ID ||
			!process.env.AWS_SECRET_ACCESS_KEY
		) {
			throw new Error(
				'S3 storage selected but S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set',
			)
		}
		return {
			kind: 's3',
			bucket: process.env.S3_BUCKET,
			publicBaseUrl: process.env.S3_PUBLIC_URL,
			client: new S3Client({
				region: process.env.S3_REGION || 'us-east-1',
				endpoint: process.env.S3_ENDPOINT,
				credentials: {
					accessKeyId: process.env.AWS_ACCESS_KEY_ID,
					secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				},
				forcePathStyle: Boolean(process.env.S3_ENDPOINT),
			}),
		}
	}

	return {
		kind: 'fs',
		baseDir: path.join(process.cwd(), 'uploads', 'audio'),
		publicBaseUrl: '/uploads/audio',
	}
}

async function storeAudioFile({
	podcastId,
	episodeId,
	audioUrl,
	storage,
}: {
	podcastId: string
	episodeId: string
	audioUrl: string
	storage: StorageConfig
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
		const storageKey = `${podcastId}/${fileNameFromUrl}`

		let publicUrl = audioUrl
		if (storage.kind === 's3') {
			await storage.client.send(
				new PutObjectCommand({
					Bucket: storage.bucket,
					Key: storageKey,
					Body: buffer,
					ContentType: contentType,
				}),
			)
			publicUrl = storage.publicBaseUrl
				? `${storage.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`
				: `s3://${storage.bucket}/${storageKey}`
		} else {
			const target = path.join(storage.baseDir, storageKey)
			await fs.mkdir(path.dirname(target), { recursive: true })
			await fs.writeFile(target, buffer)
			publicUrl = storage.publicBaseUrl
				? `${storage.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`
				: target
		}

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
			explicit: channel['itunes:explicit'] === 'true',
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
		const storageConfig = createStorageConfig()
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
					duration: parseInt(episode['itunes:duration'] || '0', 10),
					episodeType: episode['itunes:episodeType'] || 'full',
					episode: parseInt(episode['itunes:episode'] || '0', 10),
					explicit: episode['itunes:explicit'] === 'true',
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
					storage: storageConfig,
				})
			}
		}
	}

	return { podcastId: podcast.id }
}
