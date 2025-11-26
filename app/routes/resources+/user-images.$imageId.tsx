import { invariantResponse } from '@epic-web/invariant'
import { prisma } from '#app/utils/db.server.ts'
import { type Route } from './+types/user-images.$imageId.ts'
import { redirect } from 'react-router'

export async function loader({ params }: Route.LoaderArgs) {
	invariantResponse(params.imageId, 'Image ID is required', { status: 400 })
	const image = await prisma.userImage.findUnique({
		where: { id: params.imageId },
		select: { contentType: true, blob: true, objectKey: true },
	})

	invariantResponse(image, 'Not found', { status: 404 })

	if (image.objectKey) {
		return redirect(
			`/resources/images?objectKey=${encodeURIComponent(image.objectKey)}`,
		)
	}

	invariantResponse(image.blob, 'Not found', { status: 404 })

	return new Response(image.blob, {
		headers: {
			'Content-Type': image.contentType,
			'Content-Length': Buffer.byteLength(image.blob).toString(),
			'Content-Disposition': `inline; filename="${params.imageId}"`,
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	})
}
