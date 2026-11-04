import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, BookmarkCheck, BookmarkPlus, Copy, Languages, Settings2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp, useAsync } from '@/lib/store'
import { cn, uid } from '@/lib/utils'
import { dedupKey } from '@shared/dedup'
import type { TranslateResult, VocabEntry } from '@shared/types'
import { Markdown } from './Markdown'
import { Button } from './ui/button'

const MAX_SELECTION = 1500
const WIDTH = 360

interface Sel {
  text: string
  context: string
  kind: VocabEntry['source']['kind']
  title: string
  ref?: string
  rect: DOMRect
}

/** The sentence around the selection, used as context for translation and saved with the word. */
function contextFor(range: Range, text: string): string {
  let el: Node | null = range.commonAncestorContainer
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement
  const block = (el as HTMLElement | null)?.closest('p, li, td, th, blockquote, h1, h2, h3, h4, dd, label, [data-translate]') as HTMLElement | null
  const full = (block?.innerText ?? text).replace(/\s+/g, ' ').trim()
  if (full.length <= 300) return full
  const sentences = full.split(/(?<=[.!?…])\s+/)
  return sentences.find((s) => s.includes(text.slice(0, 40))) ?? full.slice(0, 300)
}

function readSelection(): Sel | null {
  const s = window.getSelection()
  if (!s || s.isCollapsed || s.rangeCount === 0) return null
  const text = s.toString().replace(/\s+/g, ' ').trim()
  if (!text || !/[A-Za-z]/.test(text)) return null
  const range = s.getRangeAt(0)
  let node: Node | null = range.commonAncestorContainer
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
  const el = node as HTMLElement | null
  if (!el || el.closest('input, textarea, [data-no-translate]')) return null
  const host = el.closest('[data-translate]') as HTMLElement | null
  if (!host) return null
  const rects = range.getClientRects()
  const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect()
  return {
    text,
    context: contextFor(range, text),
    kind: host.dataset.translate === 'note' ? 'note' : host.dataset.translate === 'test' ? 'test' : 'other',
    title: host.dataset.sourceTitle ?? '',
    ref: host.dataset.sourceRef,
    rect: range.getBoundingClientRect().width ? range.getBoundingClientRect() : rect
  }
}

type State = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: TranslateResult }

export function TranslatePopover() {
  const { settings, navigate, toast, bumpData, updateSettings } = useApp()
  const { data: decks } = useAsync(() => window.api.decks.list())
  const { data: vocab } = useAsync(() => window.api.vocab.list())
  const [sel, setSel] = useState<Sel | null>(null)
  const [state, setState] = useState<State>({ status: 'idle' })
  const [saved, setSaved] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean }>({ left: 0, top: 0, above: false })
  const boxRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  const close = useCallback(() => {
    reqId.current++
    setSel(null)
    setState({ status: 'idle' })
  }, [])

  const run = useCallback(async (s: Sel) => {
    const id = ++reqId.current
    setState({ status: 'loading' })
    const result = await window.api.translate.run(s.text, s.context)
    if (id === reqId.current) setState({ status: 'done', result })
  }, [])

  // Show the popover when a selection is made inside a translatable area.
  useEffect(() => {
    const onUp = (e: MouseEvent | KeyboardEvent): void => {
      if (boxRef.current?.contains(e.target as Node)) return
      if (e instanceof KeyboardEvent && !e.shiftKey) return
      setTimeout(() => {
        const s = readSelection()
        if (!s) return
        if (s.text.length > MAX_SELECTION) {
          setSel(s)
          setSaved(false)
          setState({ status: 'done', result: { ok: false, code: 'too-long', message: `Select up to ${MAX_SELECTION} characters at a time.` } })
          return
        }
        setSel(s)
        setSaved(false)
        if (settings?.autoTranslate !== false) void run(s)
        else setState({ status: 'idle' })
      }, 10)
    }
    const onDown = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && sel) {
        e.stopPropagation()
        close()
        window.getSelection()?.removeAllRanges()
      }
    }
    const onScroll = (e: Event): void => {
      if (!boxRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('keyup', onUp)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('keyup', onUp)
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [settings?.autoTranslate, run, close, sel])

  // Place below the selection, or above it if there is no room; keep inside the window.
  useLayoutEffect(() => {
    if (!sel) return
    const h = boxRef.current?.offsetHeight ?? 160
    const margin = 10
    const left = Math.min(Math.max(margin, sel.rect.left + sel.rect.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - margin)
    const below = sel.rect.bottom + 10
    const above = below + h > window.innerHeight - margin && sel.rect.top - h - 10 > margin
    setPos({ left, top: above ? sel.rect.top - h - 10 : Math.min(below, window.innerHeight - h - margin), above })
  }, [sel, state])

  const save = async (): Promise<void> => {
    if (!sel || state.status !== 'done' || !state.result.ok) return
    await window.api.vocab.add({
      id: uid(),
      text: sel.text,
      translation: state.result.translation,
      explanation: state.result.explanation,
      source: { kind: sel.kind, title: sel.title, ref: sel.ref },
      context: sel.context !== sel.text ? sel.context : undefined,
      createdAt: new Date().toISOString(),
      deckId: deckId || undefined
    })
    setSaved(true)
    bumpData()
    const deckName = decks?.find((d) => d.id === deckId)?.name
    toast(`Saved “${sel.text.length > 40 ? sel.text.slice(0, 40) + '…' : sel.text}”${deckName ? ` to ${deckName}` : ' to vocabulary'}`, 'success')
  }

  const result = state.status === 'done' ? state.result : null
  const selKey = sel ? dedupKey(sel.text) : ''
  const known = selKey ? vocab?.find((v) => dedupKey(v.text) === selKey) : undefined
  const deckId = settings?.defaultDeckId && decks?.some((d) => d.id === settings.defaultDeckId) ? settings.defaultDeckId : ''

  return (
    <AnimatePresence>
      {sel && (
        <motion.div
          ref={boxRef}
          data-no-translate
          initial={{ opacity: 0, y: pos.above ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ left: pos.left, top: pos.top, width: WIDTH }}
          className="fixed z-[90] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]"
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2">
            <Languages className="size-3.5 text-primary" />
            <span className="text-[11.5px] font-medium text-muted-foreground">English → Українська</span>
            {result?.ok && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                · {result.provider === 'claude' ? 'Claude' : result.provider === 'gemini' ? 'Gemini' : 'DeepL'}
                {result.cached && <Zap className="size-3" aria-label="from cache" />}
              </span>
            )}
            <button className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={close} aria-label="Close">
              <X className="size-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 px-3.5 py-3">
            <p className="line-clamp-2 border-l-2 border-primary/40 pl-2.5 text-[12.5px] italic text-muted-foreground">{sel.text}</p>

            {state.status === 'idle' && (
              <Button size="sm" className="w-full" onClick={() => void run(sel)}>
                <Languages /> Translate
              </Button>
            )}

            {state.status === 'loading' && (
              <div className="space-y-2 py-1">
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-3/5 animate-pulse rounded bg-muted" />
              </div>
            )}

            {result?.ok && (
              <>
                <p className="selectable text-[15px] font-medium leading-snug">{result.translation}</p>
                {result.explanation && (
                  <div className="selectable max-h-48 overflow-y-auto rounded-lg bg-muted/50 px-3 py-2">
                    <Markdown className="text-[12.5px] leading-relaxed [&_p]:my-1">{result.explanation}</Markdown>
                  </div>
                )}
              </>
            )}

            {result && !result.ok && (
              <div className="flex gap-2 rounded-lg bg-destructive/[0.07] px-3 py-2.5 text-[12.5px]">
                <AlertCircle className="mt-px size-4 shrink-0 text-destructive" />
                <div className="flex-1 space-y-2">
                  <p className="leading-snug">{result.message}</p>
                  {(result.code === 'no-key' || result.code === 'auth') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => {
                        close()
                        navigate({ page: 'settings' })
                      }}
                    >
                      <Settings2 className="!size-3.5" /> Open Settings
                    </Button>
                  )}
                  {(result.code === 'offline' || result.code === 'rate-limit' || result.code === 'unknown') && (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => void run(sel)}>
                      Try again
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {result?.ok && known && !saved && (
            <p className="flex items-center gap-1.5 border-t bg-muted/40 px-3.5 py-1.5 text-[11.5px] text-muted-foreground">
              <BookmarkCheck className="size-3.5 text-primary" />
              Already in your vocabulary{known.translation ? ` as “${known.translation}”` : ''} — saving adds this sentence, no duplicate.
            </p>
          )}
          {result?.ok && (
            <div className="flex items-center gap-2 border-t px-3.5 py-2">
              <Button size="sm" variant={saved ? 'secondary' : 'default'} className={cn('h-7 flex-1')} disabled={saved} onClick={() => void save()}>
                {saved ? <BookmarkCheck className="!size-3.5" /> : <BookmarkPlus className="!size-3.5" />}
                {saved ? 'Saved' : known ? 'Update' : 'Save'}
              </Button>
              {decks && decks.length > 0 && (
                <select
                  value={deckId}
                  disabled={saved}
                  title="Deck for saved words"
                  onChange={(e) => void updateSettings({ defaultDeckId: e.target.value || null })}
                  className="h-7 max-w-[130px] truncate rounded-md border border-input bg-background px-1.5 text-[12px] text-muted-foreground outline-none"
                >
                  <option value="">No deck</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7"
                title="Copy translation"
                onClick={() => {
                  void navigator.clipboard.writeText(result.translation)
                  toast('Translation copied')
                }}
              >
                <Copy className="!size-3.5" />
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
