import { Outlet } from 'react-router'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'

export default function PodcastInfo() {
	return <Outlet />
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.podcastId}" exists</p>
				),
			}}
		/>
	)
}
