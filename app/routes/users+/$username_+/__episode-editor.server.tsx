import { parseWithZod } from '@conform-to/zod'
import { type ActionFunctionArgs, data, redirect } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { EpisodeEditorSchema } from '#app/routes/users+/$username_+/__episode-editor.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { uploadEpisodeImage } from '#app/utils/storage.server.ts'

export async function action({
	request,
	params,
}: ActionFunctionArgs) {
	if (params.podcastId == null) throw new Error('podcastId must be defined')
	const userId = await requireUserId(request)
	const formData = await request.formData()

	const actionType = formData.get('_action')
	if (actionType === 'delete') {
		const confirmName = formData.get('confirmName')
		const episdoe = await prisma.episode.findUnique({
			where: { id: params.episodeId },
		})

		if (!episdoe) {
			throw new Response('Podcast not found', { status: 404 })
		}

		if (typeof confirmName !== 'string' || confirmName !== episdoe.title) {
			return data([{ error: 'Podcast name does not match.' }], { status: 400 })
		}

		await prisma.episode.delete({ where: { id: params.episodeId } })

		return redirect(`/users/${params.username}/podcasts/`)
	}

	const submission = await parseWithZod(formData, {
		schema: EpisodeEditorSchema.transform((data) => ({
			...data,
			image: data.image?.file ? data.image : null,
		})),
		async: true,
	})

	if (submission.status !== 'success') {
		console.log('Submission errors:', submission.reply())
		return data(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const { title, description, pubDate, explicit, season, episode, isPublished, episodeType, image } =
		submission.value
	const episodeRecord = await prisma.episode.upsert({
		where: { id: params.episodeId ?? 'new_episode' },
		create: {
			title,
			description,
			pubDate, // backend expects a Date object
			explicit,
			guid: uuidv4(),
			duration: 0, // todo update me
			episodeType,
			link: '', // todo
			audioUrl: '', // todo
			audioSize: 0, // todo
			audioType: '', // todo
			season,
			episode,
			isPublished: isPublished,
			podcastId: params.podcastId,
		},
		update: {
			title,
			description,
			pubDate,
			explicit,
			season,
			episode,
			isPublished,
			episodeType,
		},
	})

	if (image?.file) {
		const objectKey = await uploadEpisodeImage(
			userId,
			params.podcastId,
			episodeRecord.id,
			image.file,
		)

		await prisma.episode.update({
			where: { id: episodeRecord.id },
			data: {
				image: {
					upsert: {
						create: {
							objectKey,
							contentType: image.file.type,
						},
						update: {
							objectKey,
							contentType: image.file.type,
							blob: null,
						},
					},
				},
			},
		})
	}

	return redirect(`/users/${params.username}/podcasts/${params.podcastId}`);
}
