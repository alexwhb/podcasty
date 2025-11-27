import { data } from 'react-router'
import { z } from 'zod'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import {
	ImportJobPayloadSchema,
} from '#app/utils/podcast-import.server.ts'
import { type Route } from './+types/job-status.$jobId.ts'

export async function loader({ params, request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const jobId = params.jobId
	if (!jobId) throw data('Job id is required', { status: 400 })

	const job = await prisma.job.findUnique({
		where: { id: jobId },
	})
	if (!job) {
		throw data('Job not found', { status: 404 })
	}

	// permission: only job owner (payload.userId) or admin
	const payloadUserId =
		(() => {
			if (typeof job.payload !== 'object' || job.payload === null) return null
			if ('userId' in job.payload && typeof job.payload.userId === 'string') {
				return job.payload.userId
			}
			const importPayload = ImportJobPayloadSchema.safeParse(job.payload)
			if (importPayload.success) return importPayload.data.userId
			return null
		})() ?? null
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { roles: { select: { name: true } } },
	})
	const isAdmin = Boolean(user?.roles.some((r) => r.name === 'admin'))
	if (payloadUserId && payloadUserId !== userId && !isAdmin) {
		throw data('Unauthorized', { status: 403 })
	}

	let transcript: string | null = null
	if (job.status === 'succeeded' && job.type === 'transcription') {
		const t = await prisma.transcript.findUnique({
			where: { episodeId: (job.payload as any).episodeId },
			select: { blob: true },
		})
		if (t?.blob) {
			transcript = Buffer.from(t.blob).toString('utf8')
		}
	}

	return data({
		status: job.status,
		error: job.lastError ?? null,
		result: job.result,
		transcript,
	})
}
