import { data, useLoaderData } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { PublicPodcastPage } from '#app/components/public-podcast-page.tsx'
import {
	loadPublicPodcast,
} from '#app/utils/podcast-public.server.ts'
import { type Route } from './+types/podcasts.$slug.ts'

export async function loader({ params, request }: Route.LoaderArgs) {
	const slug = params.slug
	if (!slug) throw data('Podcast slug is required', { status: 400 })

	return loadPublicPodcast({ request, slug })
}

export default function PodcastPublicRoute() {
	const data = useLoaderData<typeof loader>()
	return <PublicPodcastPage data={data} />
}

export const meta: Route.MetaFunction = ({ data, params }) => {
	if (!data) {
		return [{ title: 'Podcast | Podcasty' }]
	}

	return [
		{ title: `${data.podcast.title} | Podcasty` },
		{
			name: 'description',
			content: data.podcast.description.slice(0, 150) || params.slug,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
