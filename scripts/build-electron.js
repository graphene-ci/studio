import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const tscBin = path.join(path.dirname(require.resolve('typescript')), 'tsc.js')
const outputDirectory = 'dist_electron'

fs.rmSync(outputDirectory, { recursive: true, force: true })
execFileSync(process.execPath, [tscBin, '-p', 'tsconfig.electron.json'], {
  stdio: 'inherit',
})

fs.writeFileSync(path.join(outputDirectory, 'package.json'), JSON.stringify({ type: 'commonjs' }))

for (const name of ['main', 'preload']) {
  fs.renameSync(path.join(outputDirectory, `${name}.js`), path.join(outputDirectory, `${name}.cjs`))
}
