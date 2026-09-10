import { spawnSync } from 'node:child_process'
// Installs only the engine used by offline extension tests, never by wiki sync.
import { createRequire } from 'node:module'
import { resolve, dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const result = spawnSync(
  process.execPath,
  [
    join(dirname(require.resolve('playwright/package.json')), 'cli.js'),
    'install',
    'chromium',
    '--only-shell',
  ],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || resolve('.cache/playwright'),
    },
    stdio: 'inherit',
    windowsHide: true,
  },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
