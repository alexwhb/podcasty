import { Outlet, redirect, type LoaderFunctionArgs } from 'react-router'
import { requireUserWithRole } from '#app/utils/permissions.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	// /admin has no page of its own; the cache page is the only admin tool.
	if (new URL(request.url).pathname === '/admin') {
		throw redirect('/admin/cache')
	}
	return null
}

export default function AdminLayout() {
	return <Outlet />
}
