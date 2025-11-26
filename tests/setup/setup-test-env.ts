import 'dotenv/config'

// Provide default object storage env when running with mocks so env validation
// and MSW S3 handlers have consistent values.
process.env.AWS_ACCESS_KEY_ID ??= 'MOCK_ACCESS_KEY'
process.env.AWS_SECRET_ACCESS_KEY ??= 'MOCK_SECRET_KEY'
process.env.AWS_REGION ??= 'us-east-1'
process.env.AWS_ENDPOINT_URL_S3 ??= 'https://storage.mock'
process.env.BUCKET_NAME ??= 'mock-bucket'

await import('#app/utils/env.server.ts')
import './db-setup.ts'
// we need these to be imported first 👆

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi, type MockInstance } from 'vitest'
import { server } from '#tests/mocks/index.ts'
import './custom-matchers.ts'

afterEach(() => server.resetHandlers())
afterEach(() => cleanup())

export let consoleError: MockInstance<(typeof console)['error']>

beforeEach(() => {
	const originalConsoleError = console.error
	consoleError = vi.spyOn(console, 'error')
	consoleError.mockImplementation(
		(...args: Parameters<typeof console.error>) => {
			originalConsoleError(...args)
			throw new Error(
				'Console error was called. Call consoleError.mockImplementation(() => {}) if this is expected.',
			)
		},
	)
})
