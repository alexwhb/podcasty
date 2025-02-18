import { prisma } from '#app/utils/db.server.ts'
import { parseWithZod } from '@conform-to/zod'
import { z } from 'zod'
import { data, redirect, type ActionFunctionArgs } from 'react-router'

const PodcastEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(10000),
	author: z.string().min(1, 'Author is required.').max(100),
	language: z.string(),
	// We pass categories as a comma-separated string.
	category: z.string().optional(),
})

export async function action({ request, params }: ActionFunctionArgs) {
	const formData = await request.formData()
	const actionType = formData.get('_action')

	if (actionType === 'delete') {
		const confirmName = formData.get('confirmName')
		const podcast = await prisma.podcast.findUnique({
			where: { id: params.podcastId },
		})
		if (!podcast) {
			throw new Response('Podcast not found', { status: 404 })
		}

		if (typeof confirmName !== 'string' || confirmName !== podcast.title) {
			return [{ error: 'Podcast name does not match.' }, { status: 400 }]
		}

		await prisma.podcast.delete({ where: { id: params.id } })
		return redirect('/podcasts')
	}

	// Otherwise, perform the update action.
	const parsed = parseWithZod(formData, { schema: PodcastEditorSchema })
	if (!parsed.value) {
		return [{ errors: parsed.errors }, { status: 400 }]
	}

	const { title, description, author, language, category } = parsed.value

	await prisma.podcast.update({
		where: { id: params.id },
		data: { title, description, author, language, category },
	})

	return { success: true }
}
