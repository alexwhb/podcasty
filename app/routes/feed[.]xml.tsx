import { data, redirect, type LoaderFunctionArgs } from 'react-router'
import { getSinglePodcastIfOnlyOne } from '#app/utils/podcast-public.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	const singlePodcast = await getSinglePodcastIfOnlyOne()
	if (!singlePodcast) {
		throw data('Feed not found', { status: 404 })
	}

	const target = new URL(`/podcast/${singlePodcast.slug}/feed.xml`, request.url)
	return redirect(target.toString(), { status: 301 })
}

export default function RootFeedRedirect() {
	return null
}
