import { useLoaderData } from 'react-router'
import { type Route } from './+types/index.ts'
import { PublicPodcastPage } from '#app/components/public-podcast-page.tsx'
import {
	getSinglePodcastIfOnlyOne,
	loadPublicPodcast,
	type PublicPodcastData,
} from '#app/utils/podcast-public.server.ts'

type LoaderData = { podcastData: PublicPodcastData | null }

export async function loader({ request }: Route.LoaderArgs): Promise<LoaderData> {
	const single = await getSinglePodcastIfOnlyOne()
	if (!single) {
		return { podcastData: null }
	}

	const podcastData = await loadPublicPodcast({ request, slug: single.slug })
	return { podcastData }
}

export const meta: Route.MetaFunction = ({ data }) => {
	if (data?.podcastData) {
		return [
			{ title: `${data.podcastData.podcast.title} | Podcasty` },
			{
				name: 'description',
				content: data.podcastData.podcast.description.slice(0, 150),
			},
		]
	}

	return [
		{ title: 'Podcasty' },
		{
			name: 'description',
			content: 'Your one stop shop for hosting your own podcast',
		},
	]
}

export default function Index() {
	const { podcastData } = useLoaderData<typeof loader>()

	if (podcastData) {
		return <PublicPodcastPage data={podcastData} />
	}

	return (
		<main className="font-poppins grid h-full place-items-center">
			<h1 className="mt-24 text-5xl font-bold">Welcome to Podcasty</h1>
			<h2 className="mt-2 text-3xl font-bold">
				Your one stop shop for hosting your own podcast
			</h2>
		</main>
	)
}
