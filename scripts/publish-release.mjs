// Publishes the current version to GitHub Releases: the .dmg / .exe files from release/ and the CHANGELOG section as notes.
// Usage: npm run release:publish        (after `npm run dist:all`, and after the tag was pushed: git push --follow-tags)
// Needs the GitHub CLI (`gh`), logged in. It does NOT build or push anything.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const tag = `v${version}`

const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
const start = changelog.indexOf(`## [${version}]`)
if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`)
const rest = changelog.slice(start)
const next = rest.indexOf('\n## [', 5)
const notes = (next < 0 ? rest : rest.slice(0, next)).replace(/^## .*\n/, '').trim()

const files = [`EnglishWorkbook-${version}-arm64.dmg`, `EnglishWorkbook-Setup-${version}.exe`, `EnglishWorkbook-${version}-portable.exe`].map((f) => join(root, 'release', f))
const missing = files.filter((f) => !existsSync(f))
if (missing.length) throw new Error(`Build first (npm run dist:all). Missing:\n${missing.join('\n')}`)

console.log(`Creating release ${tag} with ${files.length} files…`)
execFileSync('gh', ['release', 'create', tag, ...files, '--title', `EnglishWorkbook ${version}`, '--notes', notes], { cwd: root, stdio: 'inherit' })
