import { z } from 'zod'

export const ImportPodcastSchema = z.object({
	rssUrl: z.string().url('Please enter a valid URL'),
	importImages: z.boolean().default(false),
	importEpisodes: z.boolean().default(false),
	importTranscripts: z.boolean().default(false),
})
