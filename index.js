import 'dotenv/config'
import * as fs from 'node:fs'
import sourceMapSupport from 'source-map-support'

sourceMapSupport.install({
	retrieveSourceMap: function (source) {
		// get source file without the `file://` prefix or `?t=...` suffix
		const match = source.match(/^file:\/\/(.*)\?t=[.\d]+$/)
		if (match) {
			return {
				url: source,
				map: fs.readFileSync(`${match[1]}.map`, 'utf8'),
			}
		}
		return null
	},
})

if (process.env.MOCKS === 'true') {
	process.env.AWS_ACCESS_KEY_ID ??= 'MOCK_ACCESS_KEY'
	process.env.AWS_SECRET_ACCESS_KEY ??= 'MOCK_SECRET_KEY'
	process.env.AWS_REGION ??= 'us-east-1'
	process.env.AWS_ENDPOINT_URL_S3 ??= 'https://storage.mock'
	process.env.BUCKET_NAME ??= 'mock-bucket'
	await import('./tests/mocks/index.ts')
}

if (process.env.NODE_ENV === 'production') {
	await import('./server-build/index.js')
} else {
	await import('./server/index.ts')
}
