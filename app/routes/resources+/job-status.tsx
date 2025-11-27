import { data, Form, useLoaderData, useSearchParams } from 'react-router'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { type Route } from './+types/job-status.tsx'

const RANGE_OPTIONS = {
	day: { label: 'Last 24h', hours: 24 },
	week: { label: 'Last 7d', hours: 24 * 7 },
	month: { label: 'Last 30d', hours: 24 * 30 },
	all: { label: 'All time', hours: null },
} as const

const PAGE_SIZE = 50

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const url = new URL(request.url)
	const rangeParam = (url.searchParams.get('range') ??
		'day') as keyof typeof RANGE_OPTIONS
	const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
	const range = RANGE_OPTIONS[rangeParam] ? rangeParam : 'day'
	const since =
		RANGE_OPTIONS[range].hours != null
			? new Date(Date.now() - RANGE_OPTIONS[range].hours * 60 * 60 * 1000)
			: null

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { roles: { select: { name: true } } },
	})
	const isAdmin = Boolean(user?.roles.some((r) => r.name === 'admin'))
	const baseWhere = isAdmin
		? {
				type: { in: ['transcription', 'import_podcast'] },
		  }
		: {
				type: { in: ['transcription', 'import_podcast'] },
				AND: [
					{
						payload: {
							path: 'userId',
							equals: userId,
						},
					},
				],
		  }
	const where = since
		? {
				...baseWhere,
				createdAt: { gte: since },
		  }
		: baseWhere

	const [jobs, total] = await Promise.all([
		prisma.job.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: PAGE_SIZE,
			skip: (page - 1) * PAGE_SIZE,
		}),
		prisma.job.count({ where }),
	])
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	return data({ jobs, range, page, totalPages })
}

export async function action({ request }: Route.ActionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	if (intent !== 'retry') {
		return data({ success: false, error: 'Invalid intent' }, { status: 400 })
	}
	const jobId = formData.get('jobId')
	if (typeof jobId !== 'string' || !jobId) {
		return data({ success: false, error: 'Job id required' }, { status: 400 })
	}

	const job = await prisma.job.findUnique({ where: { id: jobId } })
	if (!job) {
		return data({ success: false, error: 'Job not found' }, { status: 404 })
	}

	const payloadUserId =
		typeof job.payload === 'object' &&
		job.payload !== null &&
		'userId' in job.payload &&
		typeof (job.payload as any).userId === 'string'
			? (job.payload as any).userId
			: null

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { roles: { select: { name: true } } },
	})
	const isAdmin = Boolean(user?.roles.some((r) => r.name === 'admin'))
	if (payloadUserId && payloadUserId !== userId && !isAdmin) {
		return data({ success: false, error: 'Unauthorized' }, { status: 403 })
	}

	await prisma.job.update({
		where: { id: jobId },
		data: {
			status: 'pending',
			attempts: 0,
			lastError: null,
			result: null,
			startedAt: null,
			completedAt: null,
			updatedAt: new Date(),
		},
	})

	return data({ success: true })
}

export default function JobStatusList({
	loaderData,
}: Route.ComponentProps) {
	const [searchParams, setSearchParams] = useSearchParams()
	const { jobs, range, page, totalPages } = useLoaderData<typeof loader>()

	const updateParam = (key: string, value: string) => {
		const next = new URLSearchParams(searchParams)
		if (value) next.set(key, value)
		else next.delete(key)
		next.set('page', '1')
		setSearchParams(next)
	}
	const goToPage = (p: number) => {
		const next = new URLSearchParams(searchParams)
		next.set('page', String(p))
		setSearchParams(next)
	}

	return (
		<div className="container mx-auto py-10">
			<h1 className="text-2xl font-bold mb-6">Job Queue</h1>
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<label className="text-sm font-medium">
					Range:
					<select
						className="ml-2 rounded border px-2 py-1 text-sm"
						value={range}
						onChange={(e) => updateParam('range', e.target.value)}
					>
						<option value="day">Last 24h</option>
						<option value="week">Last 7d</option>
						<option value="month">Last 30d</option>
						<option value="all">All time</option>
					</select>
				</label>
			</div>
			<div className="overflow-x-auto rounded-md border">
				<table className="min-w-full divide-y divide-border">
					<thead className="bg-muted/50">
						<tr>
							<th className="px-4 py-2 text-left text-sm font-semibold">ID</th>
							<th className="px-4 py-2 text-left text-sm font-semibold">Type</th>
							<th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
							<th className="px-4 py-2 text-left text-sm font-semibold">Attempts</th>
							<th className="px-4 py-2 text-left text-sm font-semibold">Updated</th>
							<th className="px-4 py-2 text-left text-sm font-semibold">Error</th>
							<th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border bg-card">
						{loaderData.jobs.map((job) => (
							<tr key={job.id} className="hover:bg-muted/30">
								<td className="px-4 py-2 text-sm font-mono">{job.id}</td>
								<td className="px-4 py-2 text-sm">{job.type}</td>
								<td className="px-4 py-2 text-sm capitalize">{job.status}</td>
								<td className="px-4 py-2 text-sm">{job.attempts}</td>
								<td className="px-4 py-2 text-sm">
									{new Date(job.updatedAt).toLocaleString()}
								</td>
								<td className="px-4 py-2 text-sm text-destructive">
									{job.lastError || ''}
								</td>
								<td className="px-4 py-2 text-sm">
									{job.status === 'failed' ? (
										<Form method="post">
											<input type="hidden" name="jobId" value={job.id} />
											<input type="hidden" name="intent" value="retry" />
											<Button type="submit" variant="outline" size="sm">
												Retry
											</Button>
										</Form>
									) : null}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="mt-4 flex items-center justify-between">
				<div className="text-sm text-muted-foreground">
					Page {page} of {totalPages}
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => goToPage(page - 1)}
					>
						Prev
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => goToPage(page + 1)}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
