import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { parseWebStream } from 'music-metadata'
import { data } from 'react-router'
import { prisma } from './db.server.ts'

// Episode audio lives on local disk, served by /resources/audio. Stored
// audioUrl values look like /uploads/audio/<podcastId>/<file>.
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads')
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'tmp')

const AUDIO_TYPES: Record<string, string> = {
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/x-m4a',
	'.aac': 'audio/aac',
	'.wav': 'audio/wav',
}

// The client generates upload ids (crypto.randomUUID); they become directory
// names, so nothing else is accepted. Podcast ids are cuids.
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/
const PODCAST_ID_PATTERN = /^[a-z0-9]+$/i

function assertSafeIds(uploadId: string, podcastId?: string) {
	if (!UPLOAD_ID_PATTERN.test(uploadId)) {
		throw data('Invalid upload id', { status: 400 })
	}
	if (podcastId !== undefined && !PODCAST_ID_PATTERN.test(podcastId)) {
		throw data('Invalid podcast id', { status: 400 })
	}
}

export async function getUploadedChunks(uploadId: string) {
	assertSafeIds(uploadId)
	const chunks = await prisma.uploadChunk.findMany({
		where: { uploadId },
		select: { chunkIndex: true },
	})
	return chunks.map((chunk) => chunk.chunkIndex)
}

/**
 * Stores one chunk. When the last one arrives, assembles the file into the
 * podcast's audio folder and returns its audioUrl.
 */
export async function saveAudioChunk({
	podcastId,
	uploadId,
	chunkIndex,
	totalChunks,
	fileName,
	chunk,
}: {
	podcastId: string
	uploadId: string
	chunkIndex: number
	totalChunks: number
	fileName: string
	chunk: Blob
}) {
	assertSafeIds(uploadId, podcastId)
	if (chunkIndex >= totalChunks) {
		throw data('Chunk index out of range', { status: 400 })
	}
	const extension = path.extname(fileName).toLowerCase()
	if (!AUDIO_TYPES[extension]) {
		throw data('Unsupported audio format', { status: 400 })
	}

	const chunkDir = path.join(CHUNKS_DIR, uploadId)
	await fs.promises.mkdir(chunkDir, { recursive: true })
	await fs.promises.writeFile(
		path.join(chunkDir, `chunk-${chunkIndex}`),
		Buffer.from(await chunk.arrayBuffer()),
	)
	// A retried chunk reuses its row (uploadId + chunkIndex is unique).
	await prisma.upload.upsert({
		where: { id: uploadId },
		create: {
			id: uploadId,
			fileName,
			totalChunks,
			uploadedChunks: { create: { chunkIndex } },
		},
		update: {
			uploadedChunks: {
				connectOrCreate: {
					where: { uploadId_chunkIndex: { uploadId, chunkIndex } },
					create: { chunkIndex },
				},
			},
		},
	})

	const received = await prisma.uploadChunk.count({ where: { uploadId } })
	if (received < totalChunks) {
		return { status: 'chunk_uploaded' as const, chunkIndex }
	}

	const baseName =
		path
			.basename(fileName, path.extname(fileName))
			.replace(/[^A-Za-z0-9._-]+/g, '-')
			.slice(0, 80) || 'audio'
	const finalName = `${Date.now()}-${baseName}${extension}`
	const audioDir = path.join(UPLOADS_DIR, 'audio', podcastId)
	await fs.promises.mkdir(audioDir, { recursive: true })
	const output = await fs.promises.open(path.join(audioDir, finalName), 'w')
	try {
		for (let i = 0; i < totalChunks; i++) {
			await output.write(
				await fs.promises.readFile(path.join(chunkDir, `chunk-${i}`)),
			)
		}
	} finally {
		await output.close()
	}
	await fs.promises.rm(chunkDir, { recursive: true, force: true })
	await prisma.$transaction([
		prisma.uploadChunk.deleteMany({ where: { uploadId } }),
		prisma.upload.delete({ where: { id: uploadId } }),
	])

	return {
		status: 'complete' as const,
		fileName,
		audioUrl: `/uploads/audio/${podcastId}/${finalName}`,
	}
}

/**
 * Validates an audioUrl posted by the episode editor and reads the episode
 * fields from the file itself, not from anything the client sent.
 */
export async function describeUploadedAudio(audioUrl: string, podcastId: string) {
	if (!PODCAST_ID_PATTERN.test(podcastId)) {
		throw data('Invalid podcast id', { status: 400 })
	}
	const prefix = `/uploads/audio/${podcastId}/`
	const name = audioUrl.startsWith(prefix) ? audioUrl.slice(prefix.length) : ''
	const extension = path.extname(name).toLowerCase()
	const audioType = AUDIO_TYPES[extension]
	if (!name || name.includes('/') || name.includes('..') || !audioType) {
		throw data('Invalid audio file', { status: 400 })
	}
	const filePath = path.join(UPLOADS_DIR, 'audio', podcastId, name)
	const stats = await fs.promises.stat(filePath).catch(() => null)
	if (!stats?.isFile()) throw data('Audio file not found', { status: 400 })

	// parseWebStream, not parseFile: the typings resolve music-metadata's
	// browser build, which has no parseFile.
	const metadata = await parseWebStream(
		Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>,
		{ mimeType: audioType, size: stats.size },
		{ duration: true },
	).catch(() => null)
	return {
		audioUrl,
		audioSize: stats.size,
		audioType,
		duration: Math.round(metadata?.format.duration ?? 0),
	}
}
