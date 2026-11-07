import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AttemptMode, NoteDoc, ParsedTest, Settings, TestItem } from '@shared/types'
import { uid } from './utils'
import type { VocabScope } from './vocab'

export interface RunSession {
  id: string
  testId: string
  title: string
  topics: string[]
  items: TestItem[]
  mode: AttemptMode
}

export type Route =
  | { page: 'today' }
  | { page: 'notes'; noteId?: string }
  | { page: 'tests'; testId?: string }
  | { page: 'run'; session: RunSession; back: Route }
  | { page: 'vocab'; scope?: VocabScope }
  | { page: 'review'; scope: VocabScope; cram?: boolean; back: Route }
  | { page: 'writing'; entryId?: string; start?: 'essay' }
  | { page: 'stats' }
  | { page: 'settings' }

export type Page = Route['page']

export interface Toast {
  id: string
  message: string
  variant: 'default' | 'success' | 'error'
}

interface AppState {
  settings: Settings | null
  updateSettings(patch: Partial<Settings>): Promise<void>
  setSettings(s: Settings): void
  notes: NoteDoc[]
  tests: ParsedTest[]
  contentLoaded: boolean
  reloadContent(): Promise<void>
  route: Route
  navigate(route: Route): void
  /** Bumped whenever attempts / mistakes / vocabulary change so pages can refetch. */
  dataVersion: number
  bumpData(): void
  toasts: Toast[]
  toast(message: string, variant?: Toast['variant']): void
  startSession(s: Omit<RunSession, 'id'>): void
  tourOpen: boolean
  setTourOpen(open: boolean): void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [notes, setNotes] = useState<NoteDoc[]>([])
  const [tests, setTests] = useState<ParsedTest[]>([])
  const [contentLoaded, setContentLoaded] = useState(false)
  const [route, setRoute] = useState<Route>({ page: 'today' })
  const [tourOpen, setTourOpen] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const routeRef = useRef(route)
  routeRef.current = route

  useEffect(() => {
    void window.api.settings.get().then(setSettings)
  }, [])

  const loadNotes = useCallback(async () => setNotes(await window.api.content.notes()), [])
  const loadTests = useCallback(async () => setTests(await window.api.content.tests()), [])

  const reloadContent = useCallback(async () => {
    await Promise.all([loadNotes(), loadTests()])
    setContentLoaded(true)
  }, [loadNotes, loadTests])

  useEffect(() => {
    if (!settings?.contentDir) return
    void reloadContent()
    return window.api.content.onChanged((e) => {
      if (e.kind === 'notes') void loadNotes()
      else if (e.kind === 'tests') void loadTests()
      else void reloadContent()
    })
  }, [settings?.contentDir, reloadContent, loadNotes, loadTests])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await window.api.settings.update(patch))
  }, [])

  const toast = useCallback((message: string, variant: Toast['variant'] = 'default') => {
    const id = uid()
    setToasts((t) => [...t.slice(-3), { id, message, variant }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  // Words imported from <workbook>/vocabulary/*.md
  useEffect(() => {
    if (!settings?.contentDir) return
    return window.api.vocab.onChanged((e) => {
      setDataVersion((v) => v + 1)
      if (!e.changed.length) return
      const parts = [e.added && `${e.added} new`, e.updated && `${e.updated} updated`, e.existing && `${e.existing} already in your vocabulary`].filter(Boolean)
      if (parts.length) toast(`${e.changed.join(', ')}: ${parts.join(', ')}`, 'success')
    })
  }, [settings?.contentDir, toast])

  const startSession = useCallback((s: Omit<RunSession, 'id'>) => {
    const back = routeRef.current.page === 'run' ? routeRef.current.back : routeRef.current
    setRoute({ page: 'run', session: { ...s, id: uid() }, back })
  }, [])

  const value = useMemo<AppState>(
    () => ({
      settings,
      setSettings,
      updateSettings,
      notes,
      tests,
      contentLoaded,
      reloadContent,
      route,
      navigate: setRoute,
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
      toasts,
      toast,
      startSession,
      tourOpen,
      setTourOpen
    }),
    [settings, updateSettings, notes, tests, contentLoaded, reloadContent, route, dataVersion, toasts, toast, startSession, tourOpen]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}

/** Loads async data and reloads it whenever `dataVersion` (or deps) change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; reload: () => void } {
  const { dataVersion } = useApp()
  const [data, setData] = useState<T>()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    void fn().then((d) => alive && setData(d))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, tick, ...deps])
  return { data, reload: () => setTick((t) => t + 1) }
}
