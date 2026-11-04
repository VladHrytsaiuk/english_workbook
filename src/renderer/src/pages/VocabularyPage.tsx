import { AnimatePresence, motion } from 'framer-motion'
import { Check, Download, FolderInput, Languages, Pause, Play, Plus, RotateCcw, Search, Sparkles, Tag, Trash2, Volume2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKeydown } from '@/hooks/useHotkey'
import { useApp, useAsync } from '@/lib/store'
import { cn, isTyping, modKey, plural, uid } from '@/lib/utils'
import { ALL_SCOPE, buildQueue, inScope, scopeLabel, speak, STATUS_STYLE, type VocabScope } from '@/lib/vocab'
import { formatInterval, statusOf } from '@shared/srs'
import type { Deck, VocabEntry } from '@shared/types'
import { dedupKey } from '@shared/dedup'
import { LibraryNav } from './vocab/LibraryNav'
import { WordSheet } from './vocab/WordSheet'

type Sort = 'newest' | 'oldest' | 'az' | 'due' | 'hardest'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'A → Z' },
  { value: 'due', label: 'Next review' },
  { value: 'hardest', label: 'Hardest first' }
]
const NO_DECK = '__none__'

function sortEntries(list: VocabEntry[], sort: Sort): VocabEntry[] {
  const a = [...list]
  switch (sort) {
    case 'newest':
      return a.sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    case 'oldest':
      return a.sort((x, y) => x.createdAt.localeCompare(y.createdAt))
    case 'az':
      return a.sort((x, y) => x.text.localeCompare(y.text, 'en', { sensitivity: 'base' }))
    case 'due':
      return a.sort((x, y) => (x.srs.state === 0 ? 1 : 0) - (y.srs.state === 0 ? 1 : 0) || x.srs.due.localeCompare(y.srs.due))
    case 'hardest':
      return a.sort((x, y) => y.srs.lapses - x.srs.lapses || y.srs.difficulty - x.srs.difficulty)
  }
}

export function VocabularyPage() {
  const { toast, bumpData, route, navigate, settings } = useApp()
  const { data: entries } = useAsync(() => window.api.vocab.list())
  const { data: decks } = useAsync(() => window.api.decks.list())
  const { data: logs } = useAsync(() => window.api.vocab.reviews())
  const scope: VocabScope = (route.page === 'vocab' && route.scope) || ALL_SCOPE
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [grouping, setGrouping] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)
  const [tagging, setTagging] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const now = useMemo(() => new Date(), [entries])
  const list = entries ?? []
  const deckList = decks ?? []
  const deckById = useMemo(() => new Map(deckList.map((d) => [d.id, d])), [deckList])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inS = list.filter((e) => inScope(e, scope, now))
    const found = q
      ? inS.filter((e) => `${e.text} ${e.translation} ${e.topic ?? ''} ${e.tags.join(' ')} ${e.context ?? ''} ${e.note ?? ''}`.toLowerCase().includes(q))
      : inS
    return sortEntries(found, sort)
  }, [list, scope, query, sort, now])

  const queue = useMemo(() => (settings && logs ? buildQueue(list, scope, settings, logs, now) : []), [list, scope, settings, logs, now])
  const scopeCount = useMemo(() => list.filter((e) => !e.suspended && inScope(e, scope, now)).length, [list, scope, now])
  const open = list.find((e) => e.id === openId) ?? null

  // Drop selections that no longer exist / are filtered out.
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => visible.some((v) => v.id === id))))
  }, [visible])

  const setScope = (s: VocabScope): void => {
    setSelected(new Set())
    navigate({ page: 'vocab', scope: s })
  }
  const startReview = (cram = false): void => navigate({ page: 'review', scope, cram, back: { page: 'vocab', scope } })

  const refresh = (): void => bumpData()

  const update = async (id: string, patch: Partial<VocabEntry>): Promise<void> => {
    await window.api.vocab.update(id, patch)
    refresh()
  }

  const enrich = async (ids: string[]): Promise<number> => {
    setBusy((b) => new Set([...b, ...ids]))
    let ok = 0
    let lastError = ''
    for (const id of ids) {
      const r = await window.api.vocab.enrich(id)
      if (r.ok) ok++
      else lastError = r.message
      setBusy((b) => {
        const n = new Set(b)
        n.delete(id)
        return n
      })
      refresh()
      if (!r.ok && /key|offline|limit|quota/i.test(r.message)) break
    }
    if (lastError && ok === 0) toast(lastError, 'error')
    else if (ids.length > 1) toast(`Filled details for ${plural(ok, 'word')}${lastError ? ` — stopped: ${lastError}` : ''}`, ok ? 'success' : 'error')
    return ok
  }

  const autoGroup = async (): Promise<void> => {
    const ids = list.filter((e) => !e.topic).map((e) => e.id)
    if (!ids.length) return
    setGrouping(true)
    await enrich(ids)
    setGrouping(false)
  }

  const remove = async (ids: string[]): Promise<void> => {
    await window.api.vocab.remove(ids)
    if (openId && ids.includes(openId)) setOpenId(null)
    setSelected(new Set())
    setConfirmDelete(null)
    refresh()
    toast(`Deleted ${plural(ids.length, 'word')}`)
  }

  const bulk = async (fn: (ids: string[]) => Promise<void>, message: string): Promise<void> => {
    const ids = [...selected]
    await fn(ids)
    refresh()
    toast(message.replace('{n}', plural(ids.length, 'word')), 'success')
  }

  useKeydown((e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k')) {
      e.preventDefault()
      searchRef.current?.focus()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault()
      setAdding(true)
    } else if (!isTyping(e) && !e.metaKey && !e.ctrlKey && e.key === '/') {
      e.preventDefault()
      searchRef.current?.focus()
    } else if (!isTyping(e) && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'r' && queue.length && !openId) {
      e.preventDefault()
      startReview()
    } else if (e.key === 'Escape' && !isTyping(e)) {
      if (openId) setOpenId(null)
      else if (selected.size) setSelected(new Set())
    }
  })

  const toggle = (id: string): void =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (entries && entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="drag flex h-[64px] items-center border-b px-8">
          <h1 className="text-[17px] font-semibold tracking-tight">Vocabulary</h1>
        </header>
        <EmptyState icon={Languages} title="Your vocabulary is empty" className="flex-1" action={<div className="flex gap-2"><Button onClick={() => setAdding(true)}><Plus /> Add a word</Button><Button variant="outline" onClick={() => void window.api.content.openFolder('vocabulary')}>Open vocabulary folder</Button></div>}>
          Select any text in a note, a test question or a reading passage — a translation pops up with a <span className="font-medium text-foreground">Save</span> button. Or put
          Markdown lists of words into the <span className="font-mono">vocabulary/</span> folder of your workbook (format: VOCAB_FORMAT.md). Words come back for review at the right time.
        </EmptyState>
        <AddDialog open={adding} onClose={() => setAdding(false)} decks={deckList} entries={list} defaultDeck={scope.kind === 'deck' && scope.id !== 'none' ? scope.id : settings?.defaultDeckId ?? undefined} />
      </div>
    )
  }

  const allSelected = visible.length > 0 && visible.every((v) => selected.has(v.id))

  return (
    <div className="relative flex min-h-0 flex-1">
      <LibraryNav
        entries={list}
        decks={deckList}
        scope={scope}
        onScope={setScope}
        grouping={grouping}
        onAutoGroup={() => void autoGroup()}
        onRescan={async () => {
          const r = await window.api.vocab.sync()
          const issues = r.files.reduce((n, f) => n + f.issues.length, 0)
          if (!r.changed.length) toast(r.files.length ? `Files are up to date${issues ? ` · ${issues} lines skipped` : ''}` : 'No files in vocabulary/ yet')
        }}
        onCreateDeck={async (name) => {
          const d = await window.api.decks.create(name)
          refresh()
          setScope({ kind: 'deck', id: d.id })
        }}
        onRenameDeck={async (id, name) => {
          await window.api.decks.update(id, { name })
          refresh()
        }}
        onDeleteDeck={async (d) => {
          await window.api.decks.remove(d.id)
          if (scope.kind === 'deck' && scope.id === d.id) setScope(ALL_SCOPE)
          refresh()
          toast(`Deck “${d.name}” deleted — its words are kept`)
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="drag flex h-[64px] shrink-0 items-center gap-3 border-b px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{scopeLabel(scope, deckList)}</h1>
            <p className="text-[12.5px] text-muted-foreground">
              {plural(visible.length, 'word')}
              {queue.length > 0 && ` · ${queue.length} to study now`}
            </p>
          </div>
          <div className="no-drag flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), e.currentTarget.blur())}
                placeholder="Search"
                className="h-8 w-44 rounded-lg border border-transparent bg-muted/70 pl-8 pr-10 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring/50 focus:bg-background"
              />
              {!query && <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">{modKey}F</Kbd>}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-8 w-[136px] text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" title="Add a word (⌘N)" onClick={() => setAdding(true)}>
              <Plus />
            </Button>
            <Button variant="ghost" size="icon-sm" title="Export CSV" onClick={async () => {
              const path = await window.api.vocab.exportCsv(selected.size ? [...selected] : visible.map((v) => v.id))
              if (path) toast(`Exported to ${path.split('/').pop()}`, 'success')
            }}>
              <Download />
            </Button>
            {queue.length > 0 ? (
              <Button size="sm" onClick={() => startReview()} data-tour="vocab-review">
                <Play className="fill-current" /> Review {queue.length}
                <Kbd className="ml-0.5 border-white/30 bg-white/15 text-primary-foreground">R</Kbd>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={!scopeCount} onClick={() => startReview(true)} data-tour="vocab-review" title="Nothing is due — practise these words anyway">
                <Play /> Practise
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">{query ? `Nothing matches “${query}”.` : 'No words here yet.'}</p>
          ) : (
            <div className="px-4 pb-24 pt-2">
              <div className="sticky top-0 z-10 grid grid-cols-[28px_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_104px] items-center gap-3 border-b bg-background/95 px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                <input type="checkbox" className="size-3.5 accent-[hsl(var(--primary))]" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((v) => v.id)))} />
                <span>Word</span>
                <span>Українською</span>
                <span>Group</span>
                <span className="text-right">Status</span>
              </div>
              {visible.map((e) => {
                const status = e.suspended ? 'suspended' : statusOf(e)
                const st = STATUS_STYLE[status]
                const deck = e.deckId ? deckById.get(e.deckId) : undefined
                const due = new Date(e.srs.due)
                return (
                  <div
                    key={e.id}
                    onClick={() => setOpenId(e.id === openId ? null : e.id)}
                    className={cn(
                      'group grid cursor-pointer grid-cols-[28px_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_104px] items-center gap-3 rounded-lg px-2 py-2.5 transition-colors',
                      openId === e.id ? 'bg-accent' : selected.has(e.id) ? 'bg-primary/[0.05]' : 'hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[hsl(var(--primary))]"
                      checked={selected.has(e.id)}
                      onClick={(ev) => ev.stopPropagation()}
                      onChange={() => toggle(e.id)}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium">{e.text}</span>
                        <button
                          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                          title="Listen"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            speak(e.text)
                          }}
                        >
                          <Volume2 className="size-3.5" />
                        </button>
                        {busy.has(e.id) && <Sparkles className="size-3.5 shrink-0 animate-pulse text-primary" />}
                      </div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {[e.pos, e.ipa, e.level].filter(Boolean).join(' · ') || <span className="opacity-60">{e.source.title || 'added manually'}</span>}
                      </div>
                    </div>
                    <span className="truncate text-[13.5px]">{e.translation}</span>
                    <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                      {deck && <span className="size-2 shrink-0 rounded-full" style={{ background: deck.color }} title={deck.name} />}
                      <span className="truncate">{[deck?.name, e.topic].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={cn('rounded-md px-1.5 py-px text-[11px] font-medium', st.className)}>{st.label}</span>
                      {e.srs.state !== 0 && !e.suspended && (
                        <span className="text-[11px] tabular-nums text-muted-foreground">{due <= now ? 'due now' : `in ${formatInterval(now, due)}`}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bulk actions */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1.5 pl-3.5 shadow-xl"
            >
              <span className="mr-1 text-[13px] font-medium tabular-nums">{selected.size} selected</span>
              <Select
                value=""
                onValueChange={(v) => void bulk((ids) => window.api.vocab.move(ids, v === NO_DECK ? null : v), v === NO_DECK ? 'Removed {n} from decks' : `Moved {n} to “${deckById.get(v)?.name}”`)}
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 border-0 bg-transparent px-2.5 text-[12.5px] shadow-none hover:bg-accent">
                  <FolderInput className="size-3.5" /> Move to…
                </SelectTrigger>
                <SelectContent>
                  {deckList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="mr-2 inline-block size-2 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_DECK}>No deck</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setTagging(true)}>
                <Tag className="!size-3.5" /> Tag
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void enrich([...selected])}>
                <Sparkles className="!size-3.5 text-primary" /> Fill with AI
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void bulk((ids) => window.api.vocab.suspend(ids, true), 'Suspended {n}')}>
                <Pause className="!size-3.5" /> Suspend
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void bulk((ids) => window.api.vocab.reset(ids), 'Reset progress of {n}')}>
                <RotateCcw className="!size-3.5" /> Reset
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete([...selected])}>
                <Trash2 className="!size-3.5" /> Delete
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
                <X />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <WordSheet
            key={open.id}
            entry={open}
            decks={deckList}
            enriching={busy.has(open.id)}
            onClose={() => setOpenId(null)}
            onChange={(patch) => void update(open.id, patch)}
            onDelete={() => setConfirmDelete([open.id])}
            onEnrich={() => void enrich([open.id])}
            onReview={() => navigate({ page: 'review', scope: { kind: 'ids', ids: [open.id], label: open.text }, cram: true, back: { page: 'vocab', scope } })}
          />
        )}
      </AnimatePresence>

      <AddDialog open={adding} onClose={() => setAdding(false)} decks={deckList} entries={list} defaultDeck={scope.kind === 'deck' && scope.id !== 'none' ? scope.id : settings?.defaultDeckId ?? undefined} />

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete {plural(confirmDelete?.length ?? 0, 'word')}?</DialogTitle>
          <DialogDescription>The words and their learning progress will be removed. This can't be undone.</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete && void remove(confirmDelete)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TagDialog
        open={tagging}
        onClose={() => setTagging(false)}
        onApply={async (add, rm) => {
          await bulk((ids) => window.api.vocab.tag(ids, add, rm), 'Updated tags of {n}')
          setTagging(false)
        }}
      />
    </div>
  )
}

function AddDialog({ open, onClose, decks, entries, defaultDeck }: { open: boolean; onClose(): void; decks: Deck[]; entries: VocabEntry[]; defaultDeck?: string }) {
  const { bumpData, toast } = useApp()
  const [text, setText] = useState('')
  const [translation, setTranslation] = useState('')
  const [deckId, setDeckId] = useState<string>(NO_DECK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wasOpen, setWasOpen] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setText('')
      setTranslation('')
      setError('')
      setDeckId(defaultDeck ?? NO_DECK)
    }
  }

  const key = dedupKey(text)
  const duplicate = key ? entries.find((e) => dedupKey(e.text) === key) : undefined

  const autoTranslate = async (): Promise<void> => {
    if (!text.trim()) return
    setBusy(true)
    setError('')
    const r = await window.api.translate.run(text)
    setBusy(false)
    if (r.ok) setTranslation(r.translation)
    else setError(r.message)
  }

  const submit = async (): Promise<void> => {
    if (!text.trim() || !translation.trim()) return
    await window.api.vocab.add({
      id: uid(),
      text: text.trim(),
      translation: translation.trim(),
      source: { kind: 'other', title: 'Added manually' },
      createdAt: new Date().toISOString(),
      deckId: deckId === NO_DECK ? undefined : deckId
    })
    toast(duplicate ? `Updated “${duplicate.text}” — it was already saved` : `Added “${text.trim()}”`, 'success')
    bumpData()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Add to vocabulary</DialogTitle>
        <DialogDescription>An English word or phrase and its Ukrainian translation. Use “Fill with AI” later for examples and grouping.</DialogDescription>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input autoFocus placeholder="English, e.g. to look forward to" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Українською" value={translation} onChange={(e) => setTranslation(e.target.value)} />
            <Button type="button" variant="outline" disabled={!text.trim() || busy} onClick={() => void autoTranslate()}>
              <Languages /> {busy ? '…' : 'Translate'}
            </Button>
          </div>
          <Select value={deckId} onValueChange={setDeckId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DECK}>No deck</SelectItem>
              {decks.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
          {duplicate && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-800 dark:text-amber-300">
              Already in your vocabulary: <span className="font-medium">{duplicate.text}</span> — {duplicate.translation || 'no translation'}
              {duplicate.deckId && decks.find((d) => d.id === duplicate.deckId) ? ` (${decks.find((d) => d.id === duplicate.deckId)?.name})` : ''}. Saving
              updates it instead of adding a copy; progress is kept.
            </p>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim() || !translation.trim()}>
              <Check /> {duplicate ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TagDialog({ open, onClose, onApply }: { open: boolean; onClose(): void; onApply(add: string[], remove: string[]): void }) {
  const [add, setAdd] = useState('')
  const [rm, setRm] = useState('')
  const split = (s: string): string[] => s.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && (onClose(), setAdd(''), setRm(''))}>
      <DialogContent>
        <DialogTitle>Tags</DialogTitle>
        <DialogDescription>Separate tags with commas or spaces.</DialogDescription>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            onApply(split(add), split(rm))
            setAdd('')
            setRm('')
          }}
        >
          <Input autoFocus placeholder="Add tags, e.g. work, ielts" value={add} onChange={(e) => setAdd(e.target.value)} />
          <Input placeholder="Remove tags" value={rm} onChange={(e) => setRm(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!add.trim() && !rm.trim()}>
              Apply
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
