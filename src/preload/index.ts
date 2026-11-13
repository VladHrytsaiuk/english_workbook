import { contextBridge, ipcRenderer } from 'electron'
import type { WorkbookApi } from '@shared/api'
import type { ContentChangeEvent, VocabSyncSummary } from '@shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: WorkbookApi = {
  platform: process.platform,
  settings: {
    get: () => invoke('settings:get'),
    update: (patch) => invoke('settings:update', patch)
  },
  content: {
    defaultDir: () => invoke('content:defaultDir'),
    chooseFolder: () => invoke('content:chooseFolder'),
    setup: (dir) => invoke('content:setup', dir),
    notes: () => invoke('content:notes'),
    tests: () => invoke('content:tests'),
    openFolder: (sub) => invoke('content:openFolder', sub),
    openSpec: (name) => invoke('content:openSpec', name),
    revealFile: (kind, id) => invoke('content:revealFile', kind, id),
    openFile: (kind, id) => invoke('content:openFile', kind, id),
    onChanged: (cb) => {
      const listener = (_: unknown, e: ContentChangeEvent): void => cb(e)
      ipcRenderer.on('content:changed', listener)
      return () => ipcRenderer.removeListener('content:changed', listener)
    }
  },
  progress: {
    attempts: () => invoke('progress:attempts'),
    saveAttempt: (attempt, items) => invoke('progress:saveAttempt', attempt, items),
    deleteAttempt: (id) => invoke('progress:deleteAttempt', id),
    mistakes: () => invoke('progress:mistakes'),
    removeMistake: (key) => invoke('progress:removeMistake', key),
    clear: () => invoke('progress:clear')
  },
  vocab: {
    list: () => invoke('vocab:list'),
    add: (entry) => invoke('vocab:add', entry),
    update: (id, patch) => invoke('vocab:update', id, patch),
    remove: (ids) => invoke('vocab:remove', ids),
    move: (ids, deckId) => invoke('vocab:move', ids, deckId),
    tag: (ids, add, remove) => invoke('vocab:tag', ids, add, remove),
    suspend: (ids, suspended) => invoke('vocab:suspend', ids, suspended),
    reset: (ids) => invoke('vocab:reset', ids),
    review: (id, grade, mode, durationMs) => invoke('vocab:review', id, grade, mode, durationMs),
    reviews: () => invoke('vocab:reviews'),
    readingText: (ids) => invoke('vocab:readingText', ids),
    sync: () => invoke('vocab:sync'),
    onChanged: (cb) => {
      const listener = (_: unknown, e: VocabSyncSummary): void => cb(e)
      ipcRenderer.on('vocab:changed', listener)
      return () => ipcRenderer.removeListener('vocab:changed', listener)
    },
    enrich: (id) => invoke('vocab:enrich', id),
    exportCsv: (ids) => invoke('vocab:exportCsv', ids)
  },
  irregular: {
    progress: () => invoke('irregular:progress'),
    review: (id, grade) => invoke('irregular:review', id, grade),
    reset: (ids) => invoke('irregular:reset', ids)
  },
  writing: {
    list: () => invoke('writing:list'),
    create: (input) => invoke('writing:create', input),
    saveText: (id, text) => invoke('writing:saveText', id, text),
    remove: (id) => invoke('writing:remove', id),
    evaluate: (id) => invoke('writing:evaluate', id),
    chatTurn: (id, text) => invoke('writing:chatTurn', id, text)
  },
  decks: {
    list: () => invoke('decks:list'),
    create: (name, color) => invoke('decks:create', name, color),
    update: (id, patch) => invoke('decks:update', id, patch),
    remove: (id) => invoke('decks:remove', id)
  },
  translate: {
    run: (text, context) => invoke('translate:run', text, context),
    test: (provider) => invoke('translate:test', provider),
    clearCache: () => invoke('translate:clearCache'),
    cacheSize: () => invoke('translate:cacheSize')
  },
  secrets: {
    status: () => invoke('secrets:status'),
    set: (provider, key) => invoke('secrets:set', provider, key),
    clear: (provider) => invoke('secrets:clear', provider)
  },
  app: {
    openExternal: (url) => invoke('app:openExternal', url),
    setTheme: (theme) => invoke('app:setTheme', theme),
    version: () => invoke('app:version'),
    checkUpdate: () => invoke('app:checkUpdate'),
    updateStatus: () => invoke('update:status'),
    checkAutoUpdate: () => invoke('update:check'),
    installUpdate: () => invoke('update:install'),
    onUpdateStatus: (cb) => {
      const listener = (_e: unknown, s: Parameters<typeof cb>[0]): void => cb(s)
      ipcRenderer.on('update:status', listener)
      return () => ipcRenderer.removeListener('update:status', listener)
    },
    dataDir: () => invoke('app:dataDir'),
    openDataDir: () => invoke('app:openDataDir')
  }
}

contextBridge.exposeInMainWorld('api', api)
