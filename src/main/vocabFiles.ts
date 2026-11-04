import { BrowserWindow } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VocabSyncSummary } from '@shared/types'
import { parseVocabFile } from '@shared/vocabParser'
import { listMarkdown, toId } from './content'
import { translate } from './translate'
import { type FileForSync, syncFromFiles, updateVocab } from './vocab'

let running: Promise<VocabSyncSummary> | null = null
let again = false

function notify(summary: VocabSyncSummary): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('vocab:changed', summary)
}

/** Reads `<workbook>/vocabulary/*.md` and merges the words into the library (see `syncFromFiles`). */
export async function syncVocabularyFolder(contentDir: string): Promise<VocabSyncSummary> {
  // Coalesce bursts of file events into one sync at a time.
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    const root = join(contentDir, 'vocabulary')
    const files: FileForSync[] = []
    const report: VocabSyncSummary['files'] = []
    for (const path of listMarkdown(root)) {
      const id = toId(root, path)
      try {
        const parsed = parseVocabFile(readFileSync(path, 'utf8'))
        files.push({ id, title: id.replace(/\.md$/i, ''), parsed })
        report.push({ id, items: parsed.items.length, issues: parsed.issues })
      } catch (e) {
        report.push({ id, items: 0, issues: [{ line: 1, message: `Could not read the file: ${String(e)}` }] })
      }
    }
    const r = syncFromFiles(files)
    const summary: VocabSyncSummary = { added: r.added, updated: r.updated, existing: r.existing, files: report, changed: r.changed }
    notify(summary)
    if (r.missingTranslation.length) void translateMissing(r.missingTranslation)
    return summary
  })()
  try {
    return await running
  } finally {
    running = null
    if (again) {
      again = false
      void syncVocabularyFolder(contentDir)
    }
  }
}

/** Words added from files without a translation are translated in the background with the chosen provider. */
async function translateMissing(ids: string[]): Promise<void> {
  const { listVocab } = await import('./vocab')
  const byId = new Map(listVocab().map((v) => [v.id, v]))
  let done = 0
  for (const id of ids.slice(0, 100)) {
    const v = byId.get(id)
    if (!v || v.translation) continue
    const r = await translate(v.text, v.context)
    if (!r.ok) {
      if (['no-key', 'auth', 'quota', 'offline'].includes(r.code)) break
      continue
    }
    updateVocab(id, { translation: r.translation, explanation: v.explanation ?? (r.explanation || undefined) })
    done++
  }
  if (done) notify({ added: 0, updated: 0, existing: 0, files: [], changed: [] })
}
