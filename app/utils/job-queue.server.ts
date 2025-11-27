import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { transcribeEpisodeAudio } from '#app/utils/whisper.server.ts'
import {
	ImportJobPayloadSchema,
	importPodcastFromRss,
} from '#app/utils/podcast-import.server.ts'

type JobHandler = (job: Awaited<ReturnType<typeof getNextJob>>) => Promise<void>

const transcriptionPayloadSchema = z.object({
	episodeId: z.string(),
	userId: z.string(),
})

const jobHandlers: Record<string, JobHandler> = {
	transcription: handleTranscriptionJob,
	import_podcast: handleImportPodcastJob,
}

let workerStarted = false

export function startJobWorker() {
	if (workerStarted) return
	workerStarted = true
	void workLoop()
}

async function workLoop() {
	// simple poller; one job at a time
	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			const job = await getNextJob()
			if (!job) {
				await sleep(2000)
				continue
			}
			const handler = jobHandlers[job.type]
			if (!handler) {
				await markFailed(job.id, `No handler for job type: ${job.type}`)
				continue
			}
			await prisma.job.update({
				where: { id: job.id },
				data: {
					status: 'running',
					startedAt: new Date(),
					updatedAt: new Date(),
					attempts: { increment: 1 },
					lastError: null,
				},
			})
			try {
				await handler(job)
				// If handler did not mark as failed, mark success
				const latest = await prisma.job.findUnique({
					where: { id: job.id },
					select: { status: true },
				})
				if (latest?.status !== 'failed') {
					await prisma.job.update({
						where: { id: job.id },
						data: {
							status: 'succeeded',
							completedAt: new Date(),
							updatedAt: new Date(),
						},
					})
				}
			} catch (handlerError) {
				const message =
					handlerError instanceof Error
						? handlerError.message
						: 'Job handler failed'
				console.error(`Job ${job.id} (${job.type}) failed:`, handlerError)
				await markFailed(job.id, message)
			}
		} catch (error) {
			// Any unhandled error here, just log and continue
			console.error('Job worker error', error)
			await sleep(2000)
		}
	}
}

async function getNextJob() {
	return prisma.job.findFirst({
		where: { status: 'pending' },
		orderBy: { createdAt: 'asc' },
	})
}

async function markFailed(jobId: string, message: string) {
	await prisma.job.update({
		where: { id: jobId },
		data: {
			status: 'failed',
			lastError: message,
			completedAt: new Date(),
			updatedAt: new Date(),
		},
	})
}

async function handleTranscriptionJob(job: NonNullable<Awaited<ReturnType<typeof getNextJob>>>) {
	const parsed = transcriptionPayloadSchema.safeParse(job.payload)
	if (!parsed.success) {
		await markFailed(job.id, 'Invalid transcription payload')
		throw new Error('Invalid transcription payload')
	}
	const { episodeId, userId } = parsed.data
	try {
		await transcribeEpisodeAudio({ episodeId, userId })
		await prisma.job.update({
			where: { id: job.id },
			data: {
				result: { transcriptId: episodeId },
			},
		})
	} catch (error) {
		await markFailed(job.id, error instanceof Error ? error.message : 'Transcription failed')
		throw error
	}
}

async function handleImportPodcastJob(job: NonNullable<Awaited<ReturnType<typeof getNextJob>>>) {
	const parsed = ImportJobPayloadSchema.safeParse(job.payload)
	if (!parsed.success) {
		await markFailed(job.id, 'Invalid import payload')
		throw new Error('Invalid import payload')
	}

	try {
		const result = await importPodcastFromRss(parsed.data)
		await prisma.job.update({
			where: { id: job.id },
			data: {
				result: { podcastId: result.podcastId },
			},
		})
	} catch (error) {
		await markFailed(
			job.id,
			error instanceof Error ? error.message : 'Import failed',
		)
		throw error
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
