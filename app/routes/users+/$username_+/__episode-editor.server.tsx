import { prisma } from '#app/utils/db.server.ts'
import { parseWithZod } from '@conform-to/zod'
import { data, redirect } from 'react-router'
import { z } from 'zod'

export const EpisodeEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(10000),
	// pubDate as a string in the desired format.
	pubDate: z.string().min(1, 'Publish date is required.'),
	// explicit is represented as a boolean.
	explicit: z.boolean(),
})

export type EpisodeEditor = z.infer<typeof EpisodeEditorSchema>

export async function action({
	request,
	params,
}: {
	request: Request
	params: { podcastId: string; episodeId: string }
}) {
	if (!params.episodeId) throw new Error('episodeId is required')
	const formData = await request.formData()
	const result = parseWithZod(formData, { schema: EpisodeEditorSchema })
	if (!result.success) {
		return data({ errors: result.error }, { status: 400 })
	}
	const { title, description, pubDate, explicit } = result.data
	await prisma.episode.update({
		where: { id: params.episodeId },
		data: {
			title,
			description,
			pubDate: new Date(pubDate), // backend expects a Date object
			explicit,
		},
	})
	return redirect(`/podcast/${params.podcastId}/episodes`)
}
