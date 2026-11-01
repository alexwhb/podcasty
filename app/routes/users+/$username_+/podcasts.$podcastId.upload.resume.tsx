import { getUploadedChunks } from '#app/utils/audio-upload.server.ts'
import { ResumeSchema } from '#app/utils/chunk-upload/upload-utils.ts'
import { requirePodcastOwner } from '#app/utils/podcast-access.server.ts'
import { type Route } from './+types/podcasts.$podcastId.upload.resume.ts'

export async function loader({ request, params }: Route.LoaderArgs) {
	await requirePodcastOwner(request, params.podcastId)
	const validation = ResumeSchema.safeParse({
		uploadId: new URL(request.url).searchParams.get('uploadId'),
	})
	if (!validation.success) {
		return Response.json(
			{ error: validation.error.errors[0]?.message, uploadedChunks: [] },
			{ status: 400 },
		)
	}
	return Response.json({
		uploadedChunks: await getUploadedChunks(validation.data.uploadId),
	})
}
