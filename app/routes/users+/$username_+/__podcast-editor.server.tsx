import { prisma } from '#app/utils/db.server.ts'
import { parseWithZod } from '@conform-to/zod'
import { data, redirect, type ActionFunctionArgs } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import {PodcastEditorSchema} from "#app/routes/users+/$username_+/__podcast-editor.tsx";
import { v4 as uuidv4 } from "uuid";

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
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

	const submission = await parseWithZod(formData, {
		schema: PodcastEditorSchema,
	})

	if (submission.status !== 'success') {
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
		baseUrl
	} = submission.value

	const updatePodcast = await prisma.podcast.upsert({
  select: { id: true, owner: { select: { username: true } } },
  where: { id: podcastId ?? "__new_podcast__" },
  create: {
    ownerId: userId,
    title,
    description,
    author,
    language,
    category,
    // Add the missing required properties with default values or logic
    link: baseUrl, // Replace with actual link or default
    generator: "Podcasty", // Replace with your app's name
    lastBuildDate: new Date(), // Or use a string if appropriate
    copyright: `© ${author}`, // Replace with your copyright info
    imageUrl: "https://example.com/image.jpg", // Replace with default image URL
    baseUrl: baseUrl,
    explicit: explicit, // Or true, depending on your content
    type: type, // Or "serial", depending on your podcast
    guid: uuidv4(),
    locked: locked, // Or true, if the podcast is locked
    license: author, // Or your chosen license
    imageTitle: "Podcast Image", // Replace with default image title
    imageLink: "", // Replace with default image link
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
    baseUrl
  },
});

    console.log(updatePodcast)

	// TODO maybe add toast saying that it was successfuly add/updated
	return redirect(
		`/users/${updatePodcast.owner.username}/podcasts/${updatePodcast.id}`,
	)
}
