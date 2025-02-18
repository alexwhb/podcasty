import MinimalEditor from '#app/components/rich-text-editor.tsx'
import { json } from '@remix-run/server-runtime'
import { useRouteLoaderData } from 'react-router'
import { Descendant } from 'slate'

export async function loader() {
	return {}
}

export default function test() {
	return (
		<MinimalEditor
			initialHTML={`<p>Welcome to a special episode of Rogue Creators! Today, I'm interviewing Steven Crovotta, marking our first video episode and our first guest from outside southern Oregon. If you're listening, be sure to watch the video on our YouTube channel, Rogue Creators (link in the show notes).</p><p>Steven has developed several successful mobile apps without writing any code, contracting out the design and development instead. His YouTube channel offers practical advice on app creation and marketing. Inspired by his content, I reached out to him, and he graciously agreed to join the show.</p><p>In this episode, Steven shares his journey from being inspired by his dad and "The Social Network" to becoming an app developer. He talks about learning marketing through social media, the importance of a supportive community, and the value of sharing real knowledge.</p><p>Check out Steven’s YouTube channel,</p><p></p><p>Steven’s Youtube: <a target="_blank" rel="noopener noreferrer nofollow" href="https://www.youtube.com/@stevencravotta">https://www.youtube.com/@stevencravotta</a></p><p>Rogue Creators on Instagram: @rogue.creators.podcasts</p><p>Rogue Creators Youtube: <a target="_blank" rel="noopener noreferrer nofollow" href="https://www.youtube.com/watch?v=0f4CwT67iLk">https://www.youtube.com/watch?v=0f4CwT67iLk</a></p>`}
			onChange={function (element: {
				type: string
				url?: string
				children: Descendant[]
			}): void {
				throw new Error('Function not implemented.')
			}}
		/>
	)
}
