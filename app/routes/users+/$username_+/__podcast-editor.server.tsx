import { parseWithZod } from '@conform-to/zod'
import { parseFormData } from '@mjackson/form-data-parser'
import { type ActionFunctionArgs, data, redirect } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { PodcastEditorSchema } from '#app/routes/users+/$username_+/__podcast-editor.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { uploadHandler } from '#app/utils/file-uploads.server.ts'
import { uploadPodcastImage } from '#app/utils/storage.server.ts'
import { MAX_UPLOAD_SIZE } from './__podcast-editor.tsx'
import { ensureUniquePodcastSlug } from '#app/utils/slug.server.ts'

function imageHasFile(image: { file?: File | null }): image is { file: File } {
	return Boolean(image.file && image.file.size > 0)
}

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await parseFormData(
		request,
		{ maxFileSize: MAX_UPLOAD_SIZE },
		async (file) => uploadHandler(file),
	)

	const actionType = formData.get('_action')

	if (actionType === 'delete') {
		const confirmName = formData.get('confirmName')
		const podcast = await prisma.podcast.findUnique({
			where: { id: params.podcastId }
		})

		if (!podcast) {
			throw new Response('Podcast not found', { status: 404 })
		}

		if (typeof confirmName !== 'string' || confirmName !== podcast.title) {
			return data([{ error: 'Podcast name does not match.' }], { status: 400 })
		}

		await prisma.$transaction([
			prisma.podcast.delete({ where: { id: params.podcastId } }),
		]);

		return redirect(`/users/${params.username}/podcasts/`)
	}

	const submission = await parseWithZod(formData, {
		schema: PodcastEditorSchema.transform(async (data) => {
			console.log('Parsed data before transform:', data)
			const image = {
				file: data.image?.file,
				id: data.image?.id,
			}

			if (imageHasFile(image)) {
				return {
					...data,
					imageUpdate: {
						id: image.id,
						file: image.file,
					},
				}
			} else {
				return {
					...data,
					imageUpdate: null,
				}
			}
		}),
		async: true,
	})

	if (submission.status !== 'success') {
		console.log('Submission errors:', submission.reply())
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const {
		id: podcastId,
		title,
		description,
		author,
		language,
		category,
		type,
		locked,
		explicit,
		baseUrl,
		imageUpdate,
	} = submission.value

	// Check if the podcast has an existing image before attempting to delete
	const existingPodcast = podcastId
		? await prisma.podcast.findUnique({
				where: { id: podcastId },
				select: { image: { select: { id: true } }, slug: true },
			})
		: null
	const slug =
		existingPodcast?.slug ?? (await ensureUniquePodcastSlug(title))

	const updatedPodcast = await prisma.podcast.upsert({
		select: { id: true },
		where: { id: podcastId ?? '__new_podcast__' },
		create: {
			// Your create logic remains the same
			ownerId: userId,
			slug,
			title,
			description,
			author,
			language,
			category,
			link: baseUrl,
			generator: 'Podcasty',
			lastBuildDate: new Date(),
			copyright: `© ${author}`,
			baseUrl,
			explicit,
			type,
			locked,
			guid: uuidv4(),
			license: author,
			isSingleWebsite,
		},
		update: {
			title,
			description,
			author,
			language,
			category,
			locked,
			type,
			explicit,
			baseUrl,
			slug,
		},
	})

	if (imageUpdate === null && existingPodcast?.image) {
		await prisma.podcast.update({
			where: { id: updatedPodcast.id },
			data: { image: { delete: true } },
		})
	}

	if (imageUpdate?.file) {
		const objectKey = await uploadPodcastImage(
			userId,
			updatedPodcast.id,
			imageUpdate.file,
		)

		if (existingPodcast?.image) {
			await prisma.podcastImage.update({
				where: { id: existingPodcast.image.id },
				data: {
					objectKey,
					contentType: imageUpdate.file.type,
					blob: null,
				},
			})
		} else {
			await prisma.podcast.update({
				where: { id: updatedPodcast.id },
				data: {
					image: {
						create: {
							objectKey,
							contentType: imageUpdate.file.type,
						},
					},
				},
			})
		}
	}

	return redirect(`/users/${params.username}/podcasts/${updatedPodcast.id}`)
}
