import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Machine-local data: `<userData>/data` (settings, API keys, translation cache). */
export function dataDir(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Learning data (words, decks, reviews, test attempts, mistakes bank) lives inside the workbook folder in
 * `.workbook/`, next to the notes and tests — so it is backed up / synced together with them.
 * Until a workbook folder is chosen it falls back to the machine-local data dir.
 */
let workbookDir: string | null = null

export const WORKBOOK_DATA_FOLDER = '.workbook'

export function learningDataDir(): string {
  return workbookDir ?? dataDir()
}

type Location = 'machine' | 'workbook'

const registry: JsonFile<unknown>[] = []

/**
 * A tiny JSON-file store with an in-memory cache and atomic writes (temp file + rename), so a crash never
 * leaves a half-written file. The cache is dropped when the file changes on disk (e.g. synced by iCloud).
 */
export class JsonFile<T> {
  private cache: T | null = null
  private cachedPath: string | null = null
  private mtime = 0

  constructor(
    readonly name: string,
    private readonly fallback: () => T,
    readonly location: Location = 'machine'
  ) {
    registry.push(this as JsonFile<unknown>)
  }

  /** Resolved on every access: `userData` and the workbook folder can change after modules are imported. */
  get path(): string {
    return join(this.location === 'workbook' ? learningDataDir() : dataDir(), this.name)
  }

  private fileMtime(p: string): number {
    try {
      return statSync(p).mtimeMs
    } catch {
      return 0
    }
  }

  get(): T {
    const p = this.path
    if (this.cache !== null && this.cachedPath === p && this.fileMtime(p) === this.mtime) return this.cache
    try {
      this.cache = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : this.fallback()
      this.mtime = this.fileMtime(p)
    } catch (e) {
      console.error(`[storage] ${p} is unreadable, starting fresh:`, e)
      // Keep the broken file for manual recovery instead of silently overwriting it.
      try {
        renameSync(p, `${p}.broken-${Date.now()}`)
      } catch {
        /* ignore */
      }
      this.cache = this.fallback()
      this.mtime = 0
    }
    this.cachedPath = p
    return this.cache
  }

  set(value: T): void {
    const p = this.path
    this.cache = value
    this.cachedPath = p
    const tmp = `${p}.tmp`
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
    renameSync(tmp, p)
    this.mtime = this.fileMtime(p)
  }

  update(fn: (current: T) => T): T {
    const next = fn(this.get())
    this.set(next)
    return next
  }

  /** Forget the in-memory copy (the next `get` reads from disk). */
  reset(): void {
    this.cache = null
    this.cachedPath = null
  }
}

const README = `This folder holds EnglishWorkbook's learning data: saved words, decks, review history,
test attempts and the mistakes bank. It lives next to your notes and tests so that it is backed up
and synced together with them.

Please don't edit these files while the app is open. Settings, API keys and the translation cache
stay on each Mac (~/Library/Application Support/EnglishWorkbook).
`

/**
 * Points learning data at `<contentDir>/.workbook/`. Files that are still in the old location
 * (machine-local data, or the previous workbook folder) are moved / copied over once — never overwritten.
 */
export function useWorkbookDir(contentDir: string): { moved: string[] } {
  const target = join(contentDir, WORKBOOK_DATA_FOLDER)
  mkdirSync(target, { recursive: true })
  const previous = workbookDir
  const moved: string[] = []
  for (const f of registry.filter((r) => r.location === 'workbook')) {
    const dest = join(target, f.name)
    if (existsSync(dest)) continue
    const fromMachine = join(dataDir(), f.name)
    const fromPrevious = previous && previous !== target ? join(previous, f.name) : null
    try {
      if (existsSync(fromMachine)) {
        copyFileSync(fromMachine, dest)
        renameSync(fromMachine, `${fromMachine}.moved-to-workbook`)
        moved.push(f.name)
      } else if (fromPrevious && existsSync(fromPrevious)) {
        // Switching workbook folders: bring the progress along (the old folder keeps its copy).
        copyFileSync(fromPrevious, dest)
        moved.push(f.name)
      }
    } catch (e) {
      console.error('[storage] could not move', f.name, e)
    }
  }
  const readme = join(target, 'README.txt')
  if (!existsSync(readme)) writeFileSync(readme, README, 'utf8')
  workbookDir = target
  registry.forEach((r) => r.reset())
  return { moved }
}
