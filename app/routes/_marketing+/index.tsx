import { type Route } from './+types/index.ts'


export const meta: Route.MetaFunction = () => [{ title: 'Podcasty' }]



export default function Index() {
	return (
		<main className="font-poppins grid h-full place-items-center">
			<h1 className="text-5xl font-bold mt-24">Welcome to Podcasty</h1>
			<h2 className="text-3xl font-bold mt-2">Your one stop shop for hosting your own podcast</h2>
		</main>
	)
}
