import { invariantResponse } from '@epic-web/invariant'
import { getSignedGetRequestInfo } from '#app/utils/storage.server.ts'
import { type Route } from './+types/images.ts'

const ONE_YEAR = 60 * 60 * 24 * 365

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const objectKey = url.searchParams.get('objectKey')
	invariantResponse(objectKey, 'objectKey query parameter is required', {
		status: 400,
	})
	// Every image the app stores is under users/. Anything else in the bucket
	// isn't meant to be public.
	invariantResponse(
		objectKey.startsWith('users/') && !objectKey.split('/').includes('..'),
		'Not found',
		{ status: 404 },
	)

	const { url: signedUrl, headers } = getSignedGetRequestInfo(objectKey)
	const response = await fetch(signedUrl, { headers })

	if (!response.ok || !response.body) {
		throw new Response('Not found', { status: 404 })
	}

	const contentType =
		response.headers.get('content-type') ?? 'application/octet-stream'

	return new Response(response.body, {
		status: response.status,
		headers: {
			'Content-Type': contentType,
			'Cache-Control': `public, max-age=${ONE_YEAR}, immutable`,
		},
	})
}
