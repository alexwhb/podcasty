import { data } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { transcribeEpisodeAudio, getWhisperConfig } from '#app/utils/whisper.server.ts'
import { type Route } from './+types/episode-transcript-generate.$episodeId.ts'

export async function action({ params, request }: Route.ActionArgs) {
	const userId = await requireUserId(request)
	const episodeId = params.episodeId
	if (!episodeId) throw data('Episode id is required', { status: 400 })

	const config = getWhisperConfig()
	if (!config.enabled) {
		return data(
			{
				success: false,
				error: config.reason,
			},
			{ status: 400 },
		)
	}

	const text = await transcribeEpisodeAudio({ episodeId, userId })

	return data({ success: true, transcript: text })
}
