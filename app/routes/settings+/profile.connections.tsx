import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { Icon } from '#app/components/ui/icon.tsx'
import { pipeHeaders } from '#app/utils/headers.server.js'
import { type Route } from './+types/profile.connections.ts'
import { type BreadcrumbHandle } from './profile.tsx'

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="link-2">Connections</Icon>,
	getSitemapEntries: () => null,
}

async function userCanDeleteConnections(userId: string) {
	return false
}

export async function loader({ request }: Route.LoaderArgs) {
	void request
	return { connections: [], canDeleteConnections: false }
}

export const headers: Route.HeadersFunction = pipeHeaders

export async function action({ request }: Route.ActionArgs) {
	void request
	return { status: 'disabled' as const }
}

export default function Connections({ loaderData }: Route.ComponentProps) {
	return (
		<div className="mx-auto max-w-md">
			<p className="text-body-md text-muted-foreground">
				Third-party connections are disabled. Use username/password or passkeys
				to sign in.
			</p>
		</div>
	)
}
