import { BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import matter from 'gray-matter'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import { parseTest } from '@shared/testParser'
import type { ContentChangeEvent, NoteDoc, ParsedTest } from '@shared/types'
import passiveNote from '../../examples/notes/passive-voice.md?raw'
import tensesNote from '../../examples/notes/tenses.md?raw'
import sampleTest from '../../examples/tests/tenses-all-types.md?raw'
import testFormat from '../../docs/TEST_FORMAT.md?raw'
import vocabFormat from '../../docs/VOCAB_FORMAT.md?raw'
import notesFormat from '../../docs/NOTES_FORMAT.md?raw'

export const DEFAULT_CONTENT_DIR = process.env.EW_DEFAULT_CONTENT_DIR || join(homedir(), 'EnglishWorkbook')

const EXAMPLES = {
  notes: { 'tenses.md': tensesNote, 'passive-voice.md': passiveNote },
  tests: { 'tenses-all-types.md': sampleTest }
} as const

function hasMarkdown(dir: string): boolean {
  return existsSync(dir) && listMarkdown(dir).length > 0
}

/**
 * Creates `notes/` and `tests/` inside `dir`. Example files are written only into a
 * sub-folder that has no Markdown yet, and existing files are never overwritten.
 */
export function prepareContentDir(dir: string): { created: string[] } {
  const created: string[] = []
  for (const kind of ['notes', 'tests'] as const) {
    const sub = join(dir, kind)
    const fresh = !hasMarkdown(sub)
    mkdirSync(sub, { recursive: true })
    if (!fresh) continue
    for (const [name, body] of Object.entries(EXAMPLES[kind])) {
      const target = join(sub, name)
      if (!existsSync(target)) {
        writeFileSync(target, body, 'utf8')
        created.push(join(kind, name))
      }
    }
  }
  return { created: [...created, ...ensureWorkbookExtras(dir)] }
}

/**
 * Things added in later versions, created for existing workbooks too: the `vocabulary/` folder and the
 * format specs. Never overwrites existing files.
 */
export function ensureWorkbookExtras(dir: string): string[] {
  const created: string[] = []
  mkdirSync(join(dir, 'vocabulary'), { recursive: true })
  for (const [name, body] of [
    ['TEST_FORMAT.md', testFormat],
    ['VOCAB_FORMAT.md', vocabFormat],
    ['NOTES_FORMAT.md', notesFormat]
  ] as const) {
    const spec = join(dir, name)
    if (!existsSync(spec)) {
      writeFileSync(spec, body, 'utf8')
      created.push(name)
    }
  }
  return created
}

export function listMarkdown(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string, depth: number): void => {
    if (depth > 6) return
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(full)
    }
  }
  walk(root, 0)
  return out
}

export const toId = (root: string, file: string): string => relative(root, file).split(sep).join('/')

export function readNotes(contentDir: string): NoteDoc[] {
  const root = join(contentDir, 'notes')
  return listMarkdown(root)
    .map((file) => {
      const raw = readFileSync(file, 'utf8').replace(/\r\n?/g, '\n')
      let data: Record<string, unknown> = {}
      let content = raw
      try {
        const fm = matter(raw)
        data = fm.data
        content = fm.content
      } catch {
        /* malformed frontmatter: show the raw file */
      }
      const id = toId(root, file)
      const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim()
      const fileTitle = id.replace(/\.md$/i, '').split('/').pop() ?? id
      const tags = Array.isArray(data.tags) ? data.tags.map(String) : typeof data.tags === 'string' ? data.tags.split(',').map((s) => s.trim()) : []
      return {
        id,
        title: (typeof data.title === 'string' && data.title.trim()) || h1 || fileTitle,
        content,
        tags,
        mtime: statSync(file).mtimeMs
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

export function readTests(contentDir: string): ParsedTest[] {
  const root = join(contentDir, 'tests')
  return listMarkdown(root)
    .map((file) => {
      const id = toId(root, file)
      try {
        return parseTest(readFileSync(file, 'utf8'), id, statSync(file).mtimeMs)
      } catch (e) {
        // The parser is defensive, but never let one file break the whole list.
        return {
          id,
          title: id,
          topics: [],
          description: '',
          blocks: [],
          items: [],
          issues: [{ severity: 'error' as const, message: `Unexpected error while reading the file: ${String(e)}` }],
          mtime: 0
        }
      }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

// ───────────── watching ─────────────

let watcher: FSWatcher | null = null
let onVocabularyChange: (() => void) | null = null

/** Called (debounced) when anything in `<workbook>/vocabulary/` changes. */
export function setVocabularyListener(fn: () => void): void {
  onVocabularyChange = fn
}

export async function watchContent(contentDir: string): Promise<void> {
  await watcher?.close()
  const notes = join(contentDir, 'notes')
  const tests = join(contentDir, 'tests')
  const vocabulary = join(contentDir, 'vocabulary')
  let vocabTimer: NodeJS.Timeout | null = null
  let pending: ContentChangeEvent['kind'] | null = null
  let timer: NodeJS.Timeout | null = null

  watcher = chokidar.watch([notes, tests, vocabulary], {
    ignoreInitial: true,
    depth: 6,
    ignored: (p) => basename(p).startsWith('.'),
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
  })
  watcher.on('all', (_event, path) => {
    if (!path.toLowerCase().endsWith('.md') && _event !== 'unlinkDir' && _event !== 'addDir') return
    if (path.startsWith(vocabulary)) {
      if (vocabTimer) clearTimeout(vocabTimer)
      vocabTimer = setTimeout(() => onVocabularyChange?.(), 300)
      return
    }
    const kind: ContentChangeEvent['kind'] = path.startsWith(notes) ? 'notes' : path.startsWith(tests) ? 'tests' : 'all'
    pending = pending && pending !== kind ? 'all' : kind
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const evt: ContentChangeEvent = { kind: pending ?? 'all' }
      pending = null
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('content:changed', evt)
    }, 150)
  })
  watcher.on('error', (e) => console.error('[watch]', e))
}

export async function stopWatching(): Promise<void> {
  await watcher?.close()
  watcher = null
}
