import { prisma } from '#app/utils/db.server.ts'
import {
	uploadEpisodeImage,
	uploadPodcastImage,
	uploadProfileImage,
} from '#app/utils/storage.server.ts'

function toFile(
	blob: Buffer | Uint8Array,
	filename: string,
	contentType: string | null | undefined,
) {
	const type = contentType ?? 'application/octet-stream'
	return new File([blob], filename, { type })
}

async function migrateUserImages() {
	const images = await prisma.userImage.findMany({
		where: { objectKey: null, blob: { not: null } },
		select: { id: true, userId: true, blob: true, contentType: true },
	})
	let migrated = 0

	for (const image of images) {
		const file = toFile(
			image.blob as Buffer,
			`${image.id}.bin`,
			image.contentType,
		)
		const objectKey = await uploadProfileImage(image.userId, file)
		await prisma.userImage.update({
			where: { id: image.id },
			data: { objectKey, blob: null, contentType: image.contentType },
		})
		migrated++
		console.log(`User image ${image.id} -> ${objectKey}`)
	}

	return migrated
}

async function migratePodcastImages() {
	const images = await prisma.podcastImage.findMany({
		where: { objectKey: null, blob: { not: null } },
		select: {
			id: true,
			podcastId: true,
			contentType: true,
			blob: true,
			podcast: { select: { ownerId: true } },
		},
	})
	let migrated = 0

	for (const image of images) {
		const ownerId = image.podcast.ownerId
		const file = toFile(
			image.blob as Buffer,
			`${image.id}.bin`,
			image.contentType,
		)
		const objectKey = await uploadPodcastImage(ownerId, image.podcastId, file)
		await prisma.podcastImage.update({
			where: { id: image.id },
			data: { objectKey, blob: null, contentType: image.contentType },
		})
		migrated++
		console.log(`Podcast image ${image.id} -> ${objectKey}`)
	}

	return migrated
}

async function migrateEpisodeImages() {
	const images = await prisma.episodeImage.findMany({
		where: { objectKey: null, blob: { not: null } },
		select: {
			id: true,
			episodeId: true,
			contentType: true,
			blob: true,
			episode: { select: { podcast: { select: { ownerId: true, id: true } } } },
		},
	})
	let migrated = 0

	for (const image of images) {
		const file = toFile(
			image.blob as Buffer,
			`${image.id}.bin`,
			image.contentType,
		)
		const podcastId = image.episode.podcast.id
		const ownerId = image.episode.podcast.ownerId
		const objectKey = await uploadEpisodeImage(
			ownerId,
			podcastId,
			image.episodeId,
			file,
		)
		await prisma.episodeImage.update({
			where: { id: image.id },
			data: { objectKey, blob: null, contentType: image.contentType },
		})
		migrated++
		console.log(`Episode image ${image.id} -> ${objectKey}`)
	}

	return migrated
}

async function main() {
	const userCount = await migrateUserImages()
	const podcastCount = await migratePodcastImages()
	const episodeCount = await migrateEpisodeImages()

	console.log(
		`Migration complete. User: ${userCount}, Podcast: ${podcastCount}, Episode: ${episodeCount}`,
	)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
