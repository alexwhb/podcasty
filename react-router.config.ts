import { type Config } from '@react-router/dev/config'
import { sentryOnBuildEnd } from '@sentry/react-router'

const MODE = process.env.NODE_ENV
const hasSentryEnv =
	process.env.SENTRY_AUTH_TOKEN &&
	process.env.SENTRY_ORG &&
	process.env.SENTRY_PROJECT

export default {
	// Defaults to true. Set to false to enable SPA for all routes.
	ssr: true,

	routeDiscovery: { mode: 'initial' },

	future: {
		unstable_optimizeDeps: true,
	},

	buildEnd: async ({ viteConfig, reactRouterConfig, buildManifest }) => {
		if (
			MODE === 'production' &&
			hasSentryEnv &&
			// sentryOnBuildEnd expects this to be present, so skip otherwise
			viteConfig?.sentryConfig
		) {
			await sentryOnBuildEnd({ viteConfig, reactRouterConfig, buildManifest })
		}
	},
} satisfies Config
