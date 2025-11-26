import type { loader as rootLoader } from '#app/root.tsx'
import type { Route } from './registration.ts'

export type LoaderArgs = Omit<
	Parameters<Exclude<Route['loader'], undefined>>[0],
	'context'
> & { context: ReturnType<typeof rootLoader> }

export type ActionArgs = Omit<
	Parameters<Exclude<Route['action'], undefined>>[0],
	'context'
> & { context: ReturnType<typeof rootLoader> }
