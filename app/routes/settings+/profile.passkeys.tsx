import { startRegistration } from '@simplewebauthn/browser'
import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useState } from 'react'
import { data, useFetcher } from 'react-router'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { type Route } from './+types/profile.passkeys.ts'
import { type BreadcrumbHandle } from './profile.tsx'

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="key">Passkeys</Icon>,
	getSitemapEntries: () => null,
}

export async function loader({ request }: Route.LoaderArgs) {
	const userId = await requireUserId(request)
	const passkeys = await prisma.passkey.findMany({
		where: { userId },
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			createdAt: true,
			deviceType: true,
			backedUp: true,
			transports: true,
		},
	})
	return { passkeys }
}

export async function action({ request }: Route.ActionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	if (intent !== 'delete') {
		return data({ status: 'idle' } as const, { status: 200 })
	}
	const id = formData.get('id')
	invariantResponse(typeof id === 'string', 'Passkey id required', {
		status: 400,
	})
	await prisma.passkey.delete({ where: { id } })
	return data({ status: 'deleted' } as const, { status: 200 })
}

export default function PasskeysRoute({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const fetcher = useFetcher<typeof action>()
	const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
		'idle',
	)
	const isPending = useIsPending()

	const deletingId =
		fetcher.formData?.get('intent') === 'delete'
			? fetcher.formData.get('id')
			: null

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<h1 className="text-h2">Passkeys</h1>
				<StatusButton
					status={isPending || status === 'pending' ? 'pending' : 'idle'}
					onClick={async () => {
						try {
							setStatus('pending')
							const optsRes = await fetch('/_auth/webauthn/registration')
							if (!optsRes.ok) throw new Error('Could not start registration')
							const { options } = await optsRes.json()
							const attestation = await startRegistration(options)
							const verifyRes = await fetch('/_auth/webauthn/registration', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(attestation),
							})
							const result = await verifyRes.json()
							if (result.status === 'success') {
								setStatus('success')
								window.location.reload()
							} else {
								throw new Error(result.error ?? 'Registration failed')
							}
						} catch (error) {
							console.error(error)
							setStatus('error')
							alert('Passkey registration failed')
						} finally {
							setStatus('idle')
						}
					}}
				>
					Register passkey
				</StatusButton>
			</div>
			<p className="text-body-md text-muted-foreground">
				You currently have {loaderData.passkeys.length} passkey
				{loaderData.passkeys.length === 1 ? '' : 's'} registered.
			</p>

			{loaderData.passkeys.length > 0 ? (
				<div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
					{loaderData.passkeys.map((passkey) => {
						const transports = passkey.transports?.split(',') ?? []
						return (
							<div
								key={passkey.id}
								className="flex flex-wrap items-center gap-3 bg-card px-4 py-3 text-sm text-card-foreground"
							>
								<div className="min-w-0 flex-1 space-y-1">
									<div className="font-medium">
										{passkey.deviceType === 'singleDevice'
											? 'Device-bound passkey'
											: 'Multi-device passkey'}
										{passkey.backedUp ? ' (backed up)' : ''}
									</div>
									<div className="text-muted-foreground">
										ID: <code className="break-all">{passkey.id}</code>
									</div>
									<div className="text-muted-foreground">
										Created:{' '}
										{new Date(passkey.createdAt).toLocaleString(undefined, {
											year: 'numeric',
											month: 'short',
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit',
										})}
									</div>
									{transports.length ? (
										<div className="text-muted-foreground">
											Transports: {transports.join(', ')}
										</div>
									) : null}
								</div>
								<fetcher.Form method="POST" className="flex items-center gap-2">
									<input type="hidden" name="intent" value="delete" />
									<input type="hidden" name="id" value={passkey.id} />
									<StatusButton
										type="submit"
										variant="destructive"
										status={
											fetcher.state !== 'idle' && deletingId === passkey.id
												? 'pending'
												: 'idle'
										}
									>
										Delete
									</StatusButton>
								</fetcher.Form>
							</div>
						)
					})}
				</div>
			) : null}

			{status === 'success' ? (
				<div className="rounded border border-green-600 bg-green-50 p-3 text-sm text-green-800">
					Passkey registered successfully.
				</div>
			) : null}
		</div>
	)
}
