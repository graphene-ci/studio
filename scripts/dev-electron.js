import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'

const rootDirectory = path.resolve(import.meta.dirname, '..')
const port = 5173
const devServerUrl = `http://127.0.0.1:${port}/`
const viteBin = path.join(rootDirectory, 'node_modules/vite/bin/vite.js')
const electronBin = path.join(rootDirectory, 'node_modules/electron/cli.js')

function waitForDevServer(timeoutMs = 60_000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(devServerUrl, (response) => {
        response.resume()
        resolve()
      })
      request.on('error', retry)
      request.setTimeout(1_000, () => {
        request.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Vite did not start on port ${port} within ${timeoutMs}ms`))
        return
      }
      setTimeout(probe, 300)
    }
    probe()
  })
}

async function main() {
  const vite = spawn(process.execPath, [viteBin], {
    cwd: rootDirectory,
    stdio: 'inherit',
  })
  let isViteRunning = true
  vite.once('exit', () => {
    isViteRunning = false
  })

  const stopVite = () => {
    if (isViteRunning) vite.kill()
  }

  try {
    await waitForDevServer()
  } catch (error) {
    stopVite()
    throw error
  }
  if (!isViteRunning) {
    throw new Error('Vite stopped before becoming ready')
  }

  const build = spawnSync(
    process.execPath,
    [path.join(rootDirectory, 'scripts/build-electron.js')],
    {
      cwd: rootDirectory,
      stdio: 'inherit',
    },
  )
  if (build.status !== 0) {
    stopVite()
    process.exit(build.status ?? 1)
  }

  const electron = spawn(process.execPath, [electronBin, '.'], {
    cwd: rootDirectory,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: devServerUrl },
  })

  const shutdown = () => {
    stopVite()
    electron.kill()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  electron.once('exit', (code) => {
    stopVite()
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error('[dev:exe]', error)
  process.exit(1)
})
