import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	try {
		await prisma.user.count()
		return new Response('OK')
	} catch (error: unknown) {
		console.log('healthcheck ❌', { error })
		return new Response('ERROR', { status: 500 })
	}
}
