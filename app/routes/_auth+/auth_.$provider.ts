import { redirect } from 'react-router'
import { type Route } from './+types/auth_.$provider.ts'

export async function loader() {
	return redirect('/login')
}

export async function action({ request, params }: Route.ActionArgs) {
	void params
	void request
	return redirect('/login')
}
