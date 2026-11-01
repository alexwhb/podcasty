import { saveAudioChunk } from '#app/utils/audio-upload.server.ts'
import { UploadChunkSchema } from '#app/utils/chunk-upload/upload-utils.ts'
import { requirePodcastOwner } from '#app/utils/podcast-access.server.ts'
import { type Route } from './+types/podcasts.$podcastId.upload.chunk.ts'

// Resource routes return Response.json: in react-router 7.1, data() returned
// from a resource route loses its status code.
function uploadError(error: string, status: number) {
	return Response.json({ status: 'error' as const, error }, { status })
}

// Podcast-level, so a new episode can upload audio before it has an id.
export async function action({ request, params }: Route.ActionArgs) {
	await requirePodcastOwner(request, params.podcastId)
	const formData = await request.formData()
	const validation = UploadChunkSchema.safeParse(Object.fromEntries(formData))
	if (!validation.success) {
		return uploadError(validation.error.errors[0]?.message ?? 'Invalid upload', 400)
	}
	try {
		return Response.json(
			await saveAudioChunk({ ...validation.data, podcastId: params.podcastId }),
		)
	} catch (error) {
		// saveAudioChunk throws data('message', { status: 400 }) for bad input.
		if (error && typeof error === 'object' && 'data' in error && 'init' in error) {
			const { data: message, init } = error as {
				data: unknown
				init: { status?: number } | null
			}
			return uploadError(String(message), init?.status ?? 400)
		}
		console.error('Audio upload failed', error)
		return uploadError('Upload failed', 500)
	}
}
