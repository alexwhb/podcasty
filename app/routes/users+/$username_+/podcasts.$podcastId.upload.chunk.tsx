import { data } from 'react-router'
import { saveAudioChunk } from '#app/utils/audio-upload.server.ts'
import { UploadChunkSchema } from '#app/utils/chunk-upload/upload-utils.ts'
import { requirePodcastOwner } from '#app/utils/podcast-access.server.ts'
import { type Route } from './+types/podcasts.$podcastId.upload.chunk.ts'

// Podcast-level, so a new episode can upload audio before it has an id.
export async function action({ request, params }: Route.ActionArgs) {
	await requirePodcastOwner(request, params.podcastId)
	const formData = await request.formData()
	const validation = UploadChunkSchema.safeParse(Object.fromEntries(formData))
	if (!validation.success) {
		return data(
			{
				status: 'error' as const,
				error: validation.error.errors[0]?.message ?? 'Invalid upload',
			},
			{ status: 400 },
		)
	}
	try {
		return await saveAudioChunk({
			...validation.data,
			podcastId: params.podcastId,
		})
	} catch (error) {
		if (error instanceof Error) {
			console.error('Audio upload failed', error)
			return data(
				{ status: 'error' as const, error: 'Upload failed' },
				{ status: 500 },
			)
		}
		throw error
	}
}
