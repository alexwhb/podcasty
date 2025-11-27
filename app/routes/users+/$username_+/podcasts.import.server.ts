import { data } from '@remix-run/server-runtime'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getErrorMessage } from '#app/utils/misc.tsx'
import {
	ImportJobPayloadSchema,
	importPodcastFromRss,
} from '#app/utils/podcast-import.server.ts'
import { ImportPodcastSchema } from '#app/schemas/import-podcast.ts'

export async function loader() {
	return data({})
}

export async function action({ request }: { request: Request }) {
	const userId = await requireUserId(request)
	const formData = await request.formData()

	const submission = await ImportPodcastSchema.safeParseAsync({
		rssUrl: formData.get('rssUrl'),
		importImages: formData.get('importImages') === 'on',
		importEpisodes: formData.get('importEpisodes') === 'on',
		importTranscripts: formData.get('importTranscripts') === 'on',
	})

	if (!submission.success) {
		return data({ error: submission.error.flatten() }, { status: 400 })
	}

	const payload = {
		...submission.data,
		userId,
	}

	try {
		const job = await prisma.job.create({
			data: {
				type: 'import_podcast',
				payload,
			},
			select: { id: true },
		})

		return data({ success: true, queued: true, jobId: job.id })
	} catch (error) {
		console.error('Error enqueuing RSS import:', error)
		return data({ error: getErrorMessage(error) }, { status: 500 })
	}
}
