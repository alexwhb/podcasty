import { prisma } from './db.server.ts'

export function slugifyTitle(title: string) {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 64) || 'podcast'
	)
}

export async function ensureUniquePodcastSlug(title: string) {
	const base = slugifyTitle(title)
	let candidate = base
	let counter = 1

	// Loop until we find an unused slug
	// In SQLite this is fine for our scale; if you switch to Postgres you may want
	// to do a single query with LIKE instead.
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const existing = await prisma.podcast.findUnique({
			where: { slug: candidate },
			select: { id: true },
		})
		if (!existing) return candidate
		counter += 1
		candidate = `${base}-${counter}`
	}
}
