import { Check, ClipboardCopy, FolderOpen, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/store'
import { minutesFor } from '@/lib/today'
import { cn, plural } from '@/lib/utils'
import { inScope, scopeLabel, type VocabScope } from '@/lib/vocab'
import testFormatSpec from '../../../../docs/TEST_FORMAT.md?raw'
import {
  ALL_KINDS_FOR_TEST,
  MIN_WORDS_FOR_TEST,
  WORD_KINDS,
  WORD_SOURCE_LABEL,
  type WordKind,
  type WordSource,
  buildWordTest,
  filterBySource,
  isTestable,
  wordTestPrompt
} from '@shared/wordTest'
import type { Deck, VocabEntry } from '@shared/types'

type Source = 'view' | WordSource
const COUNTS = [10, 20, 30]
const SOURCES: WordSource[] = ['studying', 'week', 'difficult', 'all']

export function WordTestDialog({
  open,
  onClose,
  entries,
  decks,
  viewScope
}: {
  open: boolean
  onClose(): void
  entries: VocabEntry[]
  decks: Deck[]
  /** The vocabulary view the dialog was opened from (a deck, a topic…); offered as a source when it narrows the library. */
  viewScope?: VocabScope
}) {
  const { startSession, toast } = useApp()
  const now = useMemo(() => new Date(), [open, entries])
  const pool = useMemo(() => entries.filter(isTestable), [entries])
  const viewIsNarrow = Boolean(viewScope && !(viewScope.kind === 'smart' && viewScope.id === 'all'))

  const lists = useMemo(() => {
    const out: Record<Source, VocabEntry[]> = {
      view: viewScope && viewIsNarrow ? pool.filter((e) => inScope(e, viewScope, now)) : [],
      studying: filterBySource(entries, 'studying', now),
      week: filterBySource(entries, 'week', now),
      difficult: filterBySource(entries, 'difficult', now),
      all: pool
    }
    return out
  }, [entries, pool, viewScope, viewIsNarrow, now])

  const [source, setSource] = useState<Source>('studying')
  const [count, setCount] = useState(10)
  const [kinds, setKinds] = useState<Set<WordKind>>(new Set(ALL_KINDS_FOR_TEST))
  const [wasOpen, setWasOpen] = useState(false)

  // Pick sensible defaults each time the dialog opens.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSource(viewIsNarrow && lists.view.length >= MIN_WORDS_FOR_TEST ? 'view' : lists.studying.length >= MIN_WORDS_FOR_TEST ? 'studying' : 'all')
      setCount(10)
      setKinds(new Set(ALL_KINDS_FOR_TEST))
    }
  }

  const list = lists[source]
  const label = source === 'view' && viewScope ? scopeLabel(viewScope, decks) : WORD_SOURCE_LABEL[source as WordSource]
  const words = Math.min(count, list.length)
  const rounds = kinds.has('match') ? Math.floor(words / 8) : 0
  const questions = words + rounds
  const enough = pool.length >= MIN_WORDS_FOR_TEST && list.length >= MIN_WORDS_FOR_TEST
  const canStart = enough && kinds.size > 0 && [...kinds].some((k) => k !== 'match')
  const deckName = (id: string): string | undefined => decks.find((d) => d.id === id)?.name

  const start = (): void => {
    const title = `Word test · ${label}`
    const items = buildWordTest(list, pool, { count, kinds: [...kinds], deckName, title })
    if (!items.length) {
      toast('Could not build questions for these words — turn on more question types.', 'error')
      return
    }
    startSession({ testId: 'words', title, topics: [...new Set(items.flatMap((i) => i.topics))], items, mode: 'words' })
    onClose()
  }

  const copyPrompt = async (): Promise<void> => {
    // Up to 40 words, a different random selection each time; difficult words first.
    const chosen = [...list].sort((a, b) => b.srs.lapses - a.srs.lapses || Math.random() - 0.5).slice(0, Math.min(Math.max(count, 10), 40))
    await navigator.clipboard.writeText(wordTestPrompt(chosen, testFormatSpec))
    toast(`Prompt with ${plural(chosen.length, 'word')} copied — paste it into your AI chat and save the answer as a .md file in the tests folder.`, 'success')
  }

  const toggleKind = (k: WordKind): void =>
    setKinds((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const sourceRows: { id: Source; label: string }[] = [
    ...(viewIsNarrow && viewScope ? [{ id: 'view' as Source, label: `This view: ${scopeLabel(viewScope, decks)}` }] : []),
    ...SOURCES.map((s) => ({ id: s as Source, label: WORD_SOURCE_LABEL[s] }))
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[540px]">
        <DialogTitle>Word test</DialogTitle>
        <DialogDescription>A test made of your own words. It doesn't change your review schedule — mistakes go to the mistakes bank.</DialogDescription>

        {pool.length < MIN_WORDS_FOR_TEST ? (
          <p className="rounded-lg bg-muted/60 px-3 py-3 text-[13.5px]">Save at least {MIN_WORDS_FOR_TEST} words with translations to build a test.</p>
        ) : (
          <div className="grid gap-4">
            <div>
              <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Words from</div>
              <div className="grid grid-cols-2 gap-1.5">
                {sourceRows.map((r) => {
                  const n = lists[r.id].length
                  const disabled = n < MIN_WORDS_FOR_TEST
                  return (
                    <button
                      key={r.id}
                      disabled={disabled}
                      onClick={() => setSource(r.id)}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors',
                        source === r.id ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'hover:border-foreground/20',
                        disabled && 'cursor-not-allowed opacity-45'
                      )}
                    >
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{n}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Number of words</div>
              <div className="flex w-fit rounded-lg border bg-muted/50 p-0.5">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCount(c)}
                    className={cn('h-7 min-w-12 rounded-md px-3 text-[12.5px] font-medium transition-colors', count === c ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Question types</div>
              <div className="grid grid-cols-2 gap-1.5">
                {WORD_KINDS.map((k) => {
                  const on = kinds.has(k.id)
                  return (
                    <button
                      key={k.id}
                      onClick={() => toggleKind(k.id)}
                      className={cn('flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors', on ? 'border-primary/50 bg-primary/[0.04]' : 'opacity-70 hover:opacity-100')}
                    >
                      <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium leading-tight">{k.label}</span>
                        <span className="block text-[11px] leading-tight text-muted-foreground">{k.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-[12.5px] text-muted-foreground">
            {enough ? `${plural(words, 'word')}${rounds ? ` + ${plural(rounds, 'matching round')}` : ''} · about ${minutesFor(0, questions)} min` : ' '}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!enough} onClick={() => void copyPrompt()} title="Copy a ready prompt with these words for Claude / ChatGPT">
              <ClipboardCopy /> AI prompt
            </Button>
            <Button disabled={!canStart} onClick={start}>
              <Play className="fill-current" /> Start test
            </Button>
          </div>
        </div>
        <p className="-mt-1 text-[11.5px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">AI prompt</span> copies your words and the test format. Paste it into Claude or ChatGPT, then save the answer as a .md file in the{' '}
          <button className="inline-flex items-center gap-0.5 text-primary hover:underline" onClick={() => void window.api.content.openFolder('tests')}>
            <FolderOpen className="size-3" /> tests folder
          </button>{' '}
          — it appears under Tests.
        </p>
      </DialogContent>
    </Dialog>
  )
}
