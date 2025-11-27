import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import fsExtra from 'fs-extra'
import { globSync } from 'glob'

const pkg = fsExtra.readJsonSync(path.join(process.cwd(), 'package.json'))

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const here = (...s: Array<string>) => path.join(__dirname, ...s)
const globsafe = (s: string) => s.replace(/\\/g, '/')

const allFiles = globSync(globsafe(here('../server/**/*.*')), {
	ignore: [
		'server/dev-server.js', // for development only
		'**/tsconfig.json',
		'**/eslint*',
		'**/__tests__/**',
	],
})

const entries = []
for (const file of allFiles) {
	if (/\.(ts|js|tsx|jsx)$/.test(file)) {
		entries.push(file)
	} else {
		const dest = file.replace(here('../server'), here('../server-build'))
		fsExtra.ensureDirSync(path.parse(dest).dir)
		fsExtra.copySync(file, dest)
		console.log(`copied: ${file.replace(`${here('../server')}/`, '')}`)
	}
}

console.log()

async function main() {
	console.log('building server...')
	await esbuild.build({
		entryPoints: entries,
		outdir: here('../server-build'),
		target: [`node${pkg.engines.node}`],
		platform: 'node',
		sourcemap: true,
		format: 'esm',
		logLevel: 'info',
	})

	console.log()
	console.log('building job worker...')
	await esbuild.build({
		entryPoints: [here('../app/utils/job-queue.server.ts')],
		outfile: here('../server-build/utils/job-queue.server.js'),
		bundle: true,
		target: [`node${pkg.engines.node}`],
		platform: 'node',
		sourcemap: true,
		format: 'esm',
		logLevel: 'info',
		external: ['@prisma/client', '@prisma/client/*'],
		banner: {
			// Enable CJS requires inside the bundled ESM output (AWS SDK pulls these in)
			js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
		},
	})
}

void main().catch((error: unknown) => {
	console.error(error)
	process.exit(1)
})
