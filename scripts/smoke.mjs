// Drives the built app with Playwright and saves screenshots. Dev-only helper.
// Usage: node scripts/smoke.mjs <outDir> <scenario> [--dark] [--fresh]
import { _electron as electron } from 'playwright-core'
import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { scenarios } from './scenarios.mjs'

const [outDir = '.smoke/shots', name = 'basic', ...flags] = process.argv.slice(2)
const root = resolve(import.meta.dirname, '..')
const sandbox = resolve(root, '.smoke')
const userData = join(sandbox, 'userData')
const contentDir = join(sandbox, 'EnglishWorkbook')
if (flags.includes('--fresh')) {
  rmSync(userData, { recursive: true, force: true })
  rmSync(contentDir, { recursive: true, force: true })
}
mkdirSync(outDir, { recursive: true })

const env = { ...process.env, EW_USER_DATA: userData, EW_DEFAULT_CONTENT_DIR: contentDir }
if (flags.includes('--fake')) env.EW_FAKE_TRANSLATE = '1'
delete env.ELECTRON_RUN_AS_NODE // set by VS Code; makes Electron behave like plain Node
const packaged = flags.includes('--packaged')
const app = await electron.launch({
  ...(packaged ? { executablePath: join(root, 'release/mac-arm64/EnglishWorkbook.app/Contents/MacOS/EnglishWorkbook') } : {}),
  args: packaged ? [] : [join(root, 'out/main/index.js')],
  cwd: root,
  env
})
const errors = []
if (process.env.EW_DEBUG) app.process().stdout.on('data', (d) => process.stdout.write(String(d)))
const page = await app.firstWindow()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
if (flags.includes('--dark')) await page.emulateMedia({ colorScheme: 'dark' })
await page.setViewportSize({ width: 1280, height: 820 })
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(600)

let n = 0
const shot = async (label) => {
  const file = join(outDir, `${String(++n).padStart(2, '0')}-${label}.png`)
  await page.waitForTimeout(350)
  await page.screenshot({ path: file })
  console.log('shot', file)
}
try {
  await scenarios[name]({ page, shot, app, contentDir })
} catch (e) {
  console.error('SCENARIO FAILED:', e.message)
  await shot('failure')
  process.exitCode = 1
} finally {
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'))
  else console.log('no renderer errors')
  await app.close()
}
