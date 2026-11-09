import { motion } from 'framer-motion'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, FolderOpen, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip } from '@/components/ui/tooltip'
import { useFindInPage } from '@/hooks/useFindInPage'
import { useKeydown } from '@/hooks/useHotkey'
import { useApp } from '@/lib/store'
import { cn, isTyping, modKey } from '@/lib/utils'
import type { NoteDoc } from '@shared/types'

/** Plain text of a Markdown document, for search snippets. */
function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~|]+/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
}

interface Hit {
  note: NoteDoc
  score: number
  snippet?: { before: string; match: string; after: string }
  count: number
}

function search(notes: NoteDoc[], query: string): Hit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return notes.map((note) => ({ note, score: 0, count: 0 }))
  const hits: Hit[] = []
  for (const note of notes) {
    const text = plain(note.content)
    const hay = `${note.title} ${note.tags.join(' ')} ${text}`.toLowerCase()
    if (!terms.every((t) => hay.includes(t))) continue
    const title = note.title.toLowerCase()
    let count = 0
    for (const t of terms) count += hay.split(t).length - 1
    const score = terms.reduce((s, t) => s + (title.includes(t) ? 100 : 0), 0) + count
    const lower = text.toLowerCase()
    const at = lower.indexOf(terms[0])
    const snippet =
      at >= 0
        ? {
            before: (at > 40 ? '…' : '') + text.slice(Math.max(0, at - 40), at),
            match: text.slice(at, at + terms[0].length),
            after: text.slice(at + terms[0].length, at + terms[0].length + 80) + '…'
          }
        : undefined
    hits.push({ note, score, snippet, count })
  }
  return hits.sort((a, b) => b.score - a.score)
}

/** Highlights search terms in the rendered note using the CSS Custom Highlight API (no DOM changes). */
function useSearchHighlight(container: React.RefObject<HTMLElement | null>, query: string, noteId?: string): void {
  useEffect(() => {
    const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
    if (!registry || !HighlightCtor) return
    registry.delete('search')
    const el = container.current
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1)
    if (!el || !terms.length) return
    const ranges: Range[] = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const text = node.data.toLowerCase()
      for (const t of terms) {
        let i = text.indexOf(t)
        while (i >= 0) {
          const r = new Range()
          r.setStart(node, i)
          r.setEnd(node, i + t.length)
          ranges.push(r)
          i = text.indexOf(t, i + t.length)
        }
      }
    }
    if (ranges.length) {
      registry.set('search', new HighlightCtor(...ranges))
      const rect = ranges[0].getBoundingClientRect()
      const scroller = el.closest('[data-scroll]')
      if (scroller && rect.top)
        scroller.scrollTo({
          top: scroller.scrollTop + rect.top - 180,
          behavior: 'smooth'
        })
    }
    return () => {
      registry.delete('search')
    }
  }, [container, query, noteId])
}

export function NotesPage() {
  const { notes, route, navigate, contentLoaded } = useApp()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => search(notes, query), [notes, query])
  const selectedId = route.page === 'notes' ? route.noteId : undefined
  const selected = notes.find((n) => n.id === selectedId) ?? (hits[0]?.note || notes[0])
  const select = (id: string): void => navigate({ page: 'notes', noteId: id })

  useSearchHighlight(bodyRef, query, selected?.id)
  const find = useFindInPage(bodyRef, selected?.id)
  const findRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [selected?.id])

  useKeydown((e) => {
    // ⌘F searches inside the open note; ⌘K (or /) searches the list of notes.
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      find.setOpen(true)
      requestAnimationFrame(() => {
        findRef.current?.focus()
        findRef.current?.select()
      })
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
      return
    }
    if (find.open && e.key === 'Escape' && document.activeElement !== searchRef.current) {
      find.close()
      return
    }
    if (find.open && e.key === 'Enter' && e.target === findRef.current) {
      e.preventDefault()
      find.step(e.shiftKey ? -1 : 1)
      return
    }
    if (find.open && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault()
      find.step(e.shiftKey ? -1 : 1)
      return
    }
    if (e.key === '/' && !isTyping(e)) {
      e.preventDefault()
      searchRef.current?.focus()
      return
    }
    const inSearch = document.activeElement === searchRef.current
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.activeElement === findRef.current) return
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (inSearch || !isTyping(e))) {
      e.preventDefault()
      const list = hits.map((h) => h.note)
      const i = list.findIndex((n) => n.id === selected?.id)
      const next = list[Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) select(next.id)
    }
    if (e.key === 'Escape' && inSearch) {
      setQuery('')
      searchRef.current?.blur()
    }
  })

  if (contentLoaded && !notes.length) {
    return (
      <div className="drag flex flex-1 items-center justify-center">
        <EmptyState
          icon={BookOpen}
          title="No notes yet"
          action={
            <Button variant="outline" className="no-drag" onClick={() => void window.api.content.openFolder()}>
              <FolderOpen /> Open workbook folder
            </Button>
          }
        >
          Add Markdown files to the <code className="rounded bg-muted px-1">notes/</code> folder — they appear here instantly. How to write them (with a ready-to-copy example and a
          prompt for AI):{' '}
          <button className="no-drag font-medium text-primary hover:underline" onClick={() => void window.api.content.openSpec('NOTES_FORMAT.md')}>
            NOTES_FORMAT.md
          </button>
          .
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* List */}
      <div className="flex w-[280px] shrink-0 flex-col border-r" data-tour="notes-list">
        <div className="drag flex h-[64px] shrink-0 items-center border-b px-3">
          <div className="no-drag relative w-full">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              className="h-8 w-full rounded-lg border border-transparent bg-muted/70 pl-8 pr-14 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/50 focus:bg-background"
            />
            {query ? (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : (
              <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">{modKey}K</Kbd>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {query && (
            <div className="px-2 pb-1.5 pt-1 text-[11.5px] text-muted-foreground">{hits.length ? `${hits.length} ${hits.length === 1 ? 'note' : 'notes'}` : 'Nothing found'}</div>
          )}
          {hits.map(({ note, snippet, count }) => {
            const on = note.id === selected?.id
            return (
              <button
                key={note.id}
                onClick={() => select(note.id)}
                className={cn('relative mb-0.5 w-full rounded-lg px-3 py-2.5 text-left transition-colors', on ? 'bg-accent' : 'hover:bg-accent/50')}
              >
                {on && <motion.span layoutId="note-active" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" />}
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[13.5px] font-medium">{note.title}</span>
                  {query && count > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>}
                </div>
                {snippet ? (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                    {snippet.before}
                    <mark className="rounded bg-yellow-300/50 px-0.5 text-foreground dark:bg-yellow-400/25">{snippet.match}</mark>
                    {snippet.after}
                  </p>
                ) : (
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{note.id}</p>
                )}
                {note.tags.length > 0 && !query && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10.5px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Reader */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="drag flex h-[64px] shrink-0 items-center justify-between gap-3 border-b px-8">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">{selected?.title}</div>
            <div className="truncate text-[12px] text-muted-foreground">notes/{selected?.id}</div>
          </div>
          {selected && (
            <div className="no-drag flex items-center gap-1">
              <Tooltip content="Open in default editor" side="bottom">
                <Button variant="ghost" size="icon-sm" onClick={() => void window.api.content.openFile('notes', selected.id)}>
                  <ExternalLink />
                </Button>
              </Tooltip>
              <Tooltip content="Show in Finder" side="bottom">
                <Button variant="ghost" size="icon-sm" onClick={() => void window.api.content.revealFile('notes', selected.id)}>
                  <FolderOpen />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {find.open && (
            <div className="absolute right-6 top-3 z-20 flex items-center gap-1 rounded-xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur">
              <input
                ref={findRef}
              autoFocus
                value={find.query}
                onChange={(e) => find.setQuery(e.target.value)}
                placeholder="Find in this note"
                className="h-7 w-[200px] rounded-md bg-muted/70 px-2 text-[13px] outline-none placeholder:text-muted-foreground"
              />
              <span className="w-[54px] text-center text-[11.5px] tabular-nums text-muted-foreground">
                {find.query ? (find.count ? `${find.current + 1} / ${find.count}` : '0') : ''}
              </span>
              <Button variant="ghost" size="icon-sm" disabled={!find.count} onClick={() => find.step(-1)}>
                <ChevronUp />
              </Button>
              <Button variant="ghost" size="icon-sm" disabled={!find.count} onClick={() => find.step(1)}>
                <ChevronDown />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={find.close}>
                <X />
              </Button>
            </div>
          )}
          <div ref={scrollRef} data-scroll className="flex-1 overflow-y-auto" data-tour="note-body">
            {selected && (
              <motion.article
                key={selected.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                ref={bodyRef}
                className="selectable mx-auto max-w-[780px] px-10 pb-24 pt-8"
                data-translate="note"
                data-source-title={selected.title}
                data-source-ref={selected.id}
              >
                <Markdown>{selected.content}</Markdown>
              </motion.article>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
