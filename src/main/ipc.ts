import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { existsSync, writeFileSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import type { Attempt, ReviewMode, Settings, SrsGrade, TestItem, TranslationProvider, VocabEntry, VocabInput } from '@shared/types'
import { DEFAULT_CONTENT_DIR, ensureWorkbookExtras, prepareContentDir, readNotes, readTests, watchContent } from './content'
import * as data from './data'
import { clearSecret, secretsStatus, setSecret } from './secrets'
import { learningDataDir, useWorkbookDir } from './storage'
import { syncVocabularyFolder } from './vocabFiles'
import { clearTranslationCache, enrichWord, translate, translationCacheSize } from './translate'
import * as vocab from './vocab'

function contentDir(): string {
  const dir = data.getSettings().contentDir
  if (!dir) throw new Error('Content folder is not set up yet.')
  return dir
}

/** Resolves a content-relative id safely (no `..` escapes). */
function contentPath(kind: 'notes' | 'tests', id: string): string {
  const base = join(contentDir(), kind)
  const full = normalize(join(base, id))
  if (!full.startsWith(base + sep)) throw new Error('Invalid path')
  return full
}

const PROVIDERS: TranslationProvider[] = ['deepl', 'claude', 'gemini']
const assertProvider = (p: unknown): TranslationProvider => {
  if (!PROVIDERS.includes(p as TranslationProvider)) throw new Error('Unknown provider')
  return p as TranslationProvider
}

/**
 * Makes `dir` the active workbook: creates new sub-folders / specs, moves learning data into
 * `<dir>/.workbook/`, merges duplicate words, starts watching and imports `vocabulary/*.md`.
 */
export async function activateWorkbook(dir: string): Promise<void> {
  ensureWorkbookExtras(dir)
  const { moved } = useWorkbookDir(dir)
  if (moved.length) console.log('[workbook] moved learning data into the workbook folder:', moved.join(', '))
  const merged = vocab.mergeDuplicates()
  if (merged) console.log(`[workbook] merged ${merged} duplicate words`)
  await watchContent(dir)
  void syncVocabularyFolder(dir)
}

export function applyTheme(theme: Settings['theme']): void {
  nativeTheme.themeSource = theme
}

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => data.getSettings())
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>) => {
    // contentDir is only changed via content:setup so the folder is always prepared + watched.
    const { contentDir: _ignored, ...rest } = patch
    const next = data.updateSettings(rest)
    if (rest.theme) applyTheme(rest.theme)
    return next
  })

  ipcMain.handle('content:defaultDir', () => DEFAULT_CONTENT_DIR)
  ipcMain.handle('content:chooseFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts: Electron.OpenDialogOptions = {
      title: 'Choose your EnglishWorkbook folder',
      defaultPath: data.getSettings().contentDir ?? DEFAULT_CONTENT_DIR,
      properties: ['openDirectory', 'createDirectory']
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
  ipcMain.handle('content:setup', async (_e, dir: string) => {
    if (typeof dir !== 'string' || !dir.trim()) throw new Error('No folder given')
    const { created } = prepareContentDir(dir)
    const settings = data.updateSettings({ contentDir: dir })
    await activateWorkbook(dir)
    return { created, settings }
  })
  ipcMain.handle('content:notes', () => readNotes(contentDir()))
  ipcMain.handle('content:tests', () => readTests(contentDir()))
  ipcMain.handle('content:openSpec', async (_e, name: string) => {
    if (name !== 'TEST_FORMAT.md' && name !== 'VOCAB_FORMAT.md') throw new Error('Unknown file')
    ensureWorkbookExtras(contentDir())
    await shell.openPath(join(contentDir(), name))
  })
  ipcMain.handle('content:openFolder', (_e, sub?: string) => {
    const target = sub === 'vocabulary' ? join(contentDir(), 'vocabulary') : contentDir()
    return shell.openPath(target).then(() => undefined)
  })
  ipcMain.handle('content:revealFile', (_e, kind: 'notes' | 'tests', id: string) => shell.showItemInFolder(contentPath(kind, id)))
  ipcMain.handle('content:openFile', async (_e, kind: 'notes' | 'tests', id: string) => {
    const p = contentPath(kind, id)
    if (existsSync(p)) await shell.openPath(p)
  })

  ipcMain.handle('progress:attempts', () => data.listAttempts())
  ipcMain.handle('progress:saveAttempt', (_e, attempt: Attempt, items: TestItem[]) => {
    data.saveAttempt(attempt, items)
  })
  ipcMain.handle('progress:deleteAttempt', (_e, id: string) => data.deleteAttempt(id))
  ipcMain.handle('progress:mistakes', () => data.listMistakes())
  ipcMain.handle('progress:removeMistake', (_e, key: string) => data.removeMistake(key))
  ipcMain.handle('progress:clear', () => data.clearProgress())

  const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [String(v)])
  ipcMain.handle('vocab:list', () => vocab.listVocab())
  ipcMain.handle('vocab:add', (_e, entry: VocabInput) => vocab.addVocab(entry))
  ipcMain.handle('vocab:update', (_e, id: string, patch: Partial<VocabEntry>) => vocab.updateVocab(id, patch))
  ipcMain.handle('vocab:remove', (_e, list: unknown) => vocab.removeVocab(ids(list)))
  ipcMain.handle('vocab:move', (_e, list: unknown, deckId: string | null) => vocab.moveVocab(ids(list), deckId))
  ipcMain.handle('vocab:tag', (_e, list: unknown, add: string[], remove: string[]) => vocab.tagVocab(ids(list), add ?? [], remove ?? []))
  ipcMain.handle('vocab:suspend', (_e, list: unknown, suspended: boolean) => vocab.suspendVocab(ids(list), Boolean(suspended)))
  ipcMain.handle('vocab:reset', (_e, list: unknown) => vocab.resetVocab(ids(list)))
  ipcMain.handle('vocab:review', (_e, id: string, grade: number, mode: ReviewMode, durationMs?: number) => {
    if (![1, 2, 3, 4].includes(grade)) throw new Error('Invalid grade')
    return vocab.reviewVocab(id, grade as SrsGrade, mode, durationMs)
  })
  ipcMain.handle('vocab:reviews', () => vocab.listReviews())
  ipcMain.handle('vocab:sync', () => syncVocabularyFolder(contentDir()))
  ipcMain.handle('vocab:enrich', async (_e, id: string) => {
    const all = vocab.listVocab()
    const entry = all.find((v) => v.id === id)
    if (!entry) return { ok: false, message: 'Word not found.' }
    const topics = [...new Set(all.map((v) => v.topic).filter((t): t is string => Boolean(t)))]
    const r = await enrichWord(entry, topics)
    if (!r.ok) return { ok: false, message: r.message }
    const d = r.data
    const updated = vocab.updateVocab(id, {
      pos: d.pos || entry.pos,
      ipa: d.ipa || entry.ipa,
      level: d.level || entry.level,
      topic: d.topic || entry.topic,
      examples: d.examples.length ? d.examples : entry.examples,
      translation: entry.translation || d.translation
    })
    return updated ? { ok: true, entry: updated } : { ok: false, message: 'Word not found.' }
  })
  ipcMain.handle('vocab:exportCsv', async (e, only?: string[]) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const opts: Electron.SaveDialogOptions = {
      title: 'Export vocabulary',
      defaultPath: join(app.getPath('downloads'), `vocabulary-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return null
    const list = vocab.listVocab()
    const chosen = only?.length ? list.filter((v) => only.includes(v.id)) : list
    writeFileSync(res.filePath, vocab.vocabToCsv(chosen), 'utf8')
    return res.filePath
  })

  ipcMain.handle('decks:list', () => vocab.listDecks())
  ipcMain.handle('decks:create', (_e, name: string, color?: string) => vocab.createDeck(String(name ?? ''), color))
  ipcMain.handle('decks:update', (_e, id: string, patch: { name?: string; color?: string }) => vocab.updateDeck(id, patch))
  ipcMain.handle('decks:remove', (_e, id: string) => vocab.deleteDeck(id))

  ipcMain.handle('translate:run', (_e, text: string, context?: string) => translate(String(text ?? ''), context ? String(context) : undefined))
  ipcMain.handle('translate:test', (_e, provider: unknown) =>
    translate('The bridge has been built.', undefined, { skipCache: true, provider: assertProvider(provider) })
  )
  ipcMain.handle('translate:clearCache', () => clearTranslationCache())
  ipcMain.handle('translate:cacheSize', () => translationCacheSize())

  ipcMain.handle('secrets:status', () => secretsStatus())
  ipcMain.handle('secrets:set', (_e, provider: unknown, key: string) => {
    setSecret(assertProvider(provider), String(key ?? ''))
    return secretsStatus()
  })
  ipcMain.handle('secrets:clear', (_e, provider: unknown) => {
    clearSecret(assertProvider(provider))
    return secretsStatus()
  })

  ipcMain.handle('app:openExternal', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) return shell.openExternal(url)
    return undefined
  })
  ipcMain.handle('app:setTheme', (_e, theme: Settings['theme']) => {
    data.updateSettings({ theme })
    applyTheme(theme)
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:dataDir', () => learningDataDir())
  ipcMain.handle('app:openDataDir', () => shell.openPath(learningDataDir()).then(() => undefined))
}
