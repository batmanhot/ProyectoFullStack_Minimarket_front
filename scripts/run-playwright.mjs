import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// Mantiene los navegadores E2E dentro de node_modules para no depender de la
// caché global del perfil de Windows, que puede quedar sin permisos o corrupta.
const playwrightCli = resolve(process.cwd(), 'node_modules', 'playwright', 'cli.js')
const viteCli = resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')
const apiRoot = resolve(process.cwd(), '..', '..', 'back', 'minimarket-api')
const testArgs = process.argv.slice(2)
const needsWebServer = !testArgs.includes('--ui') && !testArgs.includes('install')
const delay = (ms) => new Promise(resolveDelay => setTimeout(resolveDelay, ms))

function requireE2EDatabaseUrl() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Las pruebas E2E están prohibidas en producción.')
  }

  const databaseUrl = process.env.E2E_DATABASE_URL
  if (!databaseUrl) {
    throw new Error('E2E_DATABASE_URL es obligatoria para ejecutar pruebas E2E.')
  }

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('E2E_DATABASE_URL debe ser una URL PostgreSQL válida.')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !/e2e/i.test(parsed.pathname)) {
    throw new Error('E2E_DATABASE_URL debe apuntar a una base PostgreSQL exclusiva cuyo nombre incluya "e2e".')
  }

  return databaseUrl
}

async function waitForServer(url, label) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await delay(200)
  }
  throw new Error(`${label} was not available at ${url}`)
}

let vite
let api
async function stopVite() {
  if (!vite || vite.exitCode !== null) return
  vite.kill('SIGTERM')
  await Promise.race([once(vite, 'exit'), delay(3_000)])
  if (vite.exitCode === null) vite.kill('SIGKILL')
}

async function stopApi() {
  if (!api || api.exitCode !== null) return
  api.kill('SIGTERM')
  await Promise.race([once(api, 'exit'), delay(3_000)])
  if (api.exitCode === null) api.kill('SIGKILL')
}

async function main() {
  if (needsWebServer) {
    const e2eDatabaseUrl = requireE2EDatabaseUrl()
    const apiUrl = 'http://localhost:3002'
    api = spawn(process.execPath, ['src/server.js'], {
      cwd: apiRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3002',
        DATABASE_URL: e2eDatabaseUrl,
        E2E_DATABASE_URL: e2eDatabaseUrl,
      },
      stdio: 'inherit',
    })
    await waitForServer(`${apiUrl}/health`, 'E2E API')

    vite = spawn(process.execPath, [viteCli, '--port', '5174', '--strictPort'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_E2E: 'true',
        VITE_USE_API: 'true',
        VITE_API_URL: `${apiUrl}/api`,
      },
      stdio: 'inherit',
    })
    await waitForServer('http://localhost:5174', 'E2E frontend')
  }

  const playwright = spawn(process.execPath, [playwrightCli, ...testArgs], {
    cwd: process.cwd(),
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
    stdio: 'inherit',
  })
  const [code] = await once(playwright, 'exit')
  await stopVite()
  await stopApi()
  process.exit(code ?? 1)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, async () => {
    await stopVite()
    process.exit(130)
  })
}

main().catch(async (error) => {
  await stopVite()
  await stopApi()
  console.error(error)
  process.exit(1)
})
