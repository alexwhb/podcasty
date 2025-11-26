import { Link } from 'react-router'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getPodcastImgSrc, useDelayedIsPending } from '#app/utils/misc.tsx'
import { type Route } from './+types/podcasts.ts'

const PodcastResultSchema = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	author: z.string(),
	image: z
		.object({
			id: z.string().nullable(),
			objectKey: z.string().nullable(),
			updatedAt: z.date().nullable(),
		})
		.nullable(),
})

const PodcastResultsSchema = z.array(PodcastResultSchema)

export async function loader({ request }: Route.LoaderArgs) {
	const searchTerm =
		new URL(request.url).searchParams.get('search')?.trim() ?? ''

	const podcastsRaw = await prisma.podcast.findMany({
		where: searchTerm
			? {
					OR: [
						{ title: { contains: searchTerm, mode: 'insensitive' } },
						{ author: { contains: searchTerm, mode: 'insensitive' } },
					],
				}
			: undefined,
		select: {
			id: true,
			slug: true,
			title: true,
			author: true,
			image: { select: { id: true, objectKey: true, updatedAt: true } },
		},
		orderBy: { updatedAt: 'desc' },
		take: 50,
	})

	const podcasts = PodcastResultsSchema.parse(
		podcastsRaw.map((podcast) => ({
			...podcast,
			image: podcast.image
				? {
						id: podcast.image.id,
						objectKey: podcast.image.objectKey,
						updatedAt: podcast.image.updatedAt ?? null,
					}
				: null,
		})),
	)

	return {
		status: 'idle' as const,
		podcasts,
		searchTerm,
	}
}

export default function PodcastsSearch({
	loaderData,
}: Route.ComponentProps<typeof loader>) {
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/podcasts',
	})

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<h1 className="text-h1 text-center">Podcasts</h1>
			<div className="w-full max-w-[700px]">
				<SearchBar
					status={loaderData.status}
					autoFocus
					autoSubmit
					action="/podcasts"
					placeholder="Search podcasts"
				/>
			</div>

			<main className="w-full max-w-5xl">
				{loaderData.podcasts.length ? (
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{loaderData.podcasts.map((podcast) => (
							<li
								key={podcast.id}
								className="flex gap-3 rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md"
								data-pending={isPending ? 'true' : undefined}
							>
								<div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
									<img
										src={getPodcastImgSrc(
											{
												id: podcast.image?.id ?? undefined,
												objectKey: podcast.image?.objectKey ?? undefined,
											},
											podcast.image?.updatedAt ?? undefined,
										)}
										alt={podcast.title}
										className="h-full w-full object-cover"
									/>
								</div>
								<div className="flex min-w-0 flex-1 flex-col">
									<Link
										to={`/podcasts/${podcast.slug}`}
										className="truncate text-lg font-semibold hover:underline"
									>
										{podcast.title}
									</Link>
									<span className="truncate text-sm text-muted-foreground">
										{podcast.author}
									</span>
								</div>
							</li>
						))}
					</ul>
				) : (
					<p className="text-center text-muted-foreground">
						{loaderData.searchTerm
							? `No podcasts found for "${loaderData.searchTerm}".`
							: 'No podcasts found.'}
					</p>
				)}
			</main>
		</div>
	)
}

export const meta: Route.MetaFunction = () => [
	{ title: 'Podcasts | Podcasty' },
	{
		name: 'description',
		content: 'Search and browse podcasts',
	},
]

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
