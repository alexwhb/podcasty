import { prisma } from '#app/utils/db.server.ts'
import { parseWithZod } from '@conform-to/zod'
import { data, redirect } from 'react-router'
import { z } from 'zod'

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
	return redirect(`/podcast/${params.podcastId}`)
}
