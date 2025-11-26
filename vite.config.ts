import { reactRouter } from '@react-router/dev/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { envOnlyMacros } from 'vite-env-only'

const MODE = process.env.NODE_ENV

const hasSentryEnv =
	process.env.SENTRY_AUTH_TOKEN &&
	process.env.SENTRY_ORG &&
	process.env.SENTRY_PROJECT

if (process.env.SENTRY_AUTH_TOKEN && !hasSentryEnv) {
	// eslint-disable-next-line no-console
	console.warn(
		'[Sentry] SENTRY_AUTH_TOKEN is set but SENTRY_ORG or SENTRY_PROJECT is missing; skipping Sentry upload.',
	)
}

const sentryPluginOptions = hasSentryEnv
	? {
			disable: MODE !== 'production',
			authToken: process.env.SENTRY_AUTH_TOKEN,
			org: process.env.SENTRY_ORG,
			project: process.env.SENTRY_PROJECT,
			release: {
				name: process.env.COMMIT_SHA,
				setCommits: {
					auto: true,
				},
			},
			sourcemaps: {
				filesToDeleteAfterUpload: [
					'./build/**/*.map',
					'.server-build/**/*.map',
				],
			},
		}
	: null

export default defineConfig({
	build: {
		target: 'es2022',
		cssMinify: MODE === 'production',

		rollupOptions: {
			external: [/node:.*/, 'fsevents'],
		},

		assetsInlineLimit: (source: string) => {
			if (
				source.endsWith('sprite.svg') ||
				source.endsWith('favicon.svg') ||
				source.endsWith('apple-touch-icon.png')
			) {
				return false
			}
		},

		sourcemap: true,
	},
	server: {
		watch: {
			ignored: ['**/playwright-report/**'],
		},
	},
	// shared with the React Router Sentry buildEnd hook
	sentryConfig: sentryPluginOptions
		? {
				authToken: sentryPluginOptions.authToken,
				org: sentryPluginOptions.org,
				project: sentryPluginOptions.project,
				release: { name: sentryPluginOptions.release?.name },
				sourceMapsUploadOptions: {
					filesToDeleteAfterUpload:
						sentryPluginOptions.sourcemaps?.filesToDeleteAfterUpload,
				},
				unstable_sentryVitePluginOptions: sentryPluginOptions,
			}
		: undefined,
	plugins: [
		envOnlyMacros(),
		tailwindcss(),
		// it would be really nice to have this enabled in tests, but we'll have to
		// wait until https://github.com/remix-run/remix/issues/9871 is fixed
		process.env.NODE_ENV === 'test' ? null : reactRouter(),
		sentryPluginOptions ? sentryVitePlugin(sentryPluginOptions) : null,
	],
	test: {
		include: ['./app/**/*.test.{ts,tsx}'],
		setupFiles: ['./tests/setup/setup-test-env.ts'],
		globalSetup: ['./tests/setup/global-setup.ts'],
		restoreMocks: true,
		coverage: {
			include: ['app/**/*.{ts,tsx}'],
			all: true,
		},
	},
})
