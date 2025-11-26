import { createCookieSessionStorage } from 'react-router'
import { type ProviderName } from './connections.tsx'
import { type AuthProvider } from './providers/provider.ts'
import { type Timings } from './timing.server.ts'

export const connectionSessionStorage = createCookieSessionStorage({
	cookie: {
		name: 'en_connection',
		sameSite: 'lax', // CSRF protection is advised if changing to 'none'
		path: '/',
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		secrets: process.env.SESSION_SECRET.split(','),
		secure: process.env.NODE_ENV === 'production',
	},
})

export const providers: Record<ProviderName, AuthProvider> = {}

export function handleMockAction(providerName: ProviderName, request: Request) {
	throw new Error(`No auth providers configured (received ${providerName})`)
}

export function resolveConnectionData(
	providerName: ProviderName,
	providerId: string,
	options?: { timings?: Timings },
) {
	throw new Error(`No auth providers configured (received ${providerName})`)
}
