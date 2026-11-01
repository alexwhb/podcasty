import fs from 'node:fs'
import path from 'node:path'
import { prisma } from './db.server.ts'
import { deleteFromStorage } from './storage.server.ts'

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio')
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'tmp')
const ABANDONED_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000

type MaybeString = string | null | undefined

export type StoredFiles = {
	objectKeys?: Array<MaybeString>
	audioUrls?: Array<MaybeString>
}

function present(values: Array<MaybeString> = []) {
	return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

/**
 * Deletes image objects and local audio files that nothing references any
 * more. Call it after the database change that dropped the reference. Best
 * effort: it logs and never throws, so a cleanup failure can't fail a request
 * whose change already succeeded.
 */
export async function removeStoredFiles({ objectKeys, audioUrls }: StoredFiles) {
	try {
		const keys = present(objectKeys).filter((key) => key.startsWith('users/'))
		if (keys.length) {
			const where = { objectKey: { in: keys } }
			const [podcastImages, episodeImages, userImages] = await Promise.all([
				prisma.podcastImage.findMany({ where, select: { objectKey: true } }),
				prisma.episodeImage.findMany({ where, select: { objectKey: true } }),
				prisma.userImage.findMany({ where, select: { objectKey: true } }),
			])
			const stillUsed = new Set(
				[...podcastImages, ...episodeImages, ...userImages].map(
					(image) => image.objectKey,
				),
			)
			await deleteFromStorage(keys.filter((key) => !stillUsed.has(key)))
		}

		for (const audioUrl of present(audioUrls)) {
			if (!audioUrl.startsWith('/uploads/audio/')) continue
			const filePath = path.resolve(UPLOADS_DIR, audioUrl.slice('/uploads/'.length))
			if (!filePath.startsWith(AUDIO_DIR + path.sep)) continue
			const stillUsed = await prisma.episode.count({ where: { audioUrl } })
			if (stillUsed) continue
			await fs.promises.rm(filePath, { force: true })
		}
	} catch (error) {
		console.error('Failed to clean up stored files', error)
	}
}

/** Files belonging to an episode, collected before deleting or replacing it. */
export async function getEpisodeFiles(episodeId: string): Promise<StoredFiles> {
	const episode = await prisma.episode.findUnique({
		where: { id: episodeId },
		select: { audioUrl: true, image: { select: { objectKey: true } } },
	})
	return {
		objectKeys: [episode?.image?.objectKey],
		audioUrls: [episode?.audioUrl],
	}
}

/** Files belonging to a podcast and all its episodes. */
export async function getPodcastFiles(podcastId: string): Promise<StoredFiles> {
	const podcast = await prisma.podcast.findUnique({
		where: { id: podcastId },
		select: {
			image: { select: { objectKey: true } },
			episodes: {
				select: { audioUrl: true, image: { select: { objectKey: true } } },
			},
		},
	})
	return {
		objectKeys: [
			podcast?.image?.objectKey,
			...(podcast?.episodes ?? []).map((episode) => episode.image?.objectKey),
		],
		audioUrls: (podcast?.episodes ?? []).map((episode) => episode.audioUrl),
	}
}

/** Files belonging to a user: their profile photo and every podcast they own. */
export async function getUserFiles(userId: string): Promise<StoredFiles> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			image: { select: { objectKey: true } },
			podcasts: { select: { id: true } },
		},
	})
	const podcastFiles = await Promise.all(
		(user?.podcasts ?? []).map((podcast) => getPodcastFiles(podcast.id)),
	)
	return {
		objectKeys: [
			user?.image?.objectKey,
			...podcastFiles.flatMap((files) => files.objectKeys ?? []),
		],
		audioUrls: podcastFiles.flatMap((files) => files.audioUrls ?? []),
	}
}

/**
 * Removes chunked uploads nobody finished: their rows, and their chunk folders
 * in uploads/tmp (including folders with no row at all).
 */
export async function cleanupAbandonedUploads(
	maxAgeMs = ABANDONED_UPLOAD_AGE_MS,
) {
	const cutoff = new Date(Date.now() - maxAgeMs)
	const expired = await prisma.upload.findMany({
		where: { updatedAt: { lt: cutoff } },
		select: { id: true },
	})
	for (const { id } of expired) {
		await fs.promises.rm(path.join(CHUNKS_DIR, id), {
			recursive: true,
			force: true,
		})
		await prisma.$transaction([
			prisma.uploadChunk.deleteMany({ where: { uploadId: id } }),
			prisma.upload.delete({ where: { id } }),
		])
	}

	const folders = await fs.promises.readdir(CHUNKS_DIR).catch(() => [])
	let orphanFolders = 0
	for (const folder of folders) {
		const folderPath = path.join(CHUNKS_DIR, folder)
		const stats = await fs.promises.stat(folderPath).catch(() => null)
		if (!stats || stats.mtime >= cutoff) continue
		const hasRow = await prisma.upload.count({ where: { id: folder } })
		if (hasRow) continue
		await fs.promises.rm(folderPath, { recursive: true, force: true })
		orphanFolders++
	}
	return { expiredUploads: expired.length, orphanFolders }
}

let cleanupStarted = false

/** Runs cleanupAbandonedUploads now and then hourly. */
export function startUploadCleanup() {
	if (cleanupStarted) return
	cleanupStarted = true
	const run = () => {
		cleanupAbandonedUploads()
			.then(({ expiredUploads, orphanFolders }) => {
				if (expiredUploads || orphanFolders) {
					console.info(
						`Removed ${expiredUploads} abandoned uploads and ${orphanFolders} orphaned chunk folders`,
					)
				}
			})
			.catch((error) => {
				console.error('Abandoned upload cleanup failed', error)
			})
	}
	run()
	setInterval(run, CLEANUP_INTERVAL_MS).unref()
}
