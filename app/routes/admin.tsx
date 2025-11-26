import { redirect, type LoaderFunctionArgs } from 'react-router'

export function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	url.pathname = '/login'
	return redirect(url.toString())
}

export default function AdminRedirect() {
	// Loader handles redirect; this is fallback
	return null
}
