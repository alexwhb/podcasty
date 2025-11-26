import { redirect } from 'react-router'
import { type Route } from './+types/auth.$provider.callback.ts'

export async function loader({ request, params }: Route.LoaderArgs) {
	void request
	void params
	return redirect('/login')
}
