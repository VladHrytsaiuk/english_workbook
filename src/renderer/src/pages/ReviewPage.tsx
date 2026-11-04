import { motion } from 'framer-motion'
import { ArrowLeft, Check, Clock, Lightbulb, PartyPopper, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Progress } from '@/components/ui/progress'
import { useKeydown } from '@/hooks/useHotkey'
import { type Route, useApp } from '@/lib/store'
import { cn, isTyping, plural, shuffle } from '@/lib/utils'
import { buildQueue, pickMode, scopeLabel, speak, type VocabScope } from '@/lib/vocab'
import { checkTyped, formatInterval, makeCloze, previewDue, suggestedGrade, type TypedVerdict } from '@shared/srs'
import type { Deck, ReviewMode, SrsGrade, VocabEntry } from '@shared/types'

const GRADES: { g: SrsGrade; label: string; className: string }[] = [
  { g: 1, label: 'Again', className: 'hover:border-destructive/60 hover:bg-destructive/[0.06] data-[suggested=true]:border-destructive data-[suggested=true]:bg-destructive/[0.08]' },
  { g: 2, label: 'Hard', className: 'hover:border-amber-500/60 hover:bg-amber-500/[0.06] data-[suggested=true]:border-amber-500 data-[suggested=true]:bg-amber-500/[0.08]' },
  { g: 3, label: 'Good', className: 'hover:border-emerald-500/60 hover:bg-emerald-500/[0.06] data-[suggested=true]:border-emerald-500 data-[suggested=true]:bg-emerald-500/[0.08]' },
  { g: 4, label: 'Easy', className: 'hover:border-sky-500/60 hover:bg-sky-500/[0.06] data-[suggested=true]:border-sky-500 data-[suggested=true]:bg-sky-500/[0.08]' }
]

const MODE_LABEL: Record<ReviewMode, string> = {
  flashcard: 'Flashcard',
  typing: 'Write it in English',
  cloze: 'Fill the gap',
  choice: 'Choose the translation'
}

/** Cards that come back within this window are shown again in the same session (learning steps). */
const RESTUDY_MS = 20 * 60 * 1000

function Highlighted({ context, text }: { context: string; text: string }) {
  const c = makeCloze(context, text)
  if (!c) return <>{context}</>
  const word = context.slice(c.before.length, context.length - c.after.length)
  return (
    <>
      {c.before}
      <mark className="rounded bg-primary/15 px-0.5 font-medium text-foreground">{word}</mark>
      {c.after}
    </>
  )
}

interface SessionStats {
  reviewed: number
  again: number
  started: number
  newSeen: number
}

export function ReviewPage({ scope, cram, back }: { scope: VocabScope; cram?: boolean; back: Route }) {
  const { settings, navigate, bumpData, updateSettings } = useApp()
  const [queue, setQueue] = useState<VocabEntry[] | null>(null)
  const [pool, setPool] = useState<VocabEntry[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<SessionStats>({ reviewed: 0, again: 0, started: Date.now(), newSeen: 0 })
  const [phase, setPhase] = useState<'question' | 'answer'>('question')
  const [input, setInput] = useState('')
  const [verdict, setVerdict] = useState<TypedVerdict | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [hint, setHint] = useState(0)
  const [saving, setSaving] = useState(false)
  const shownAt = useRef(Date.now())
  const inputRef = useRef<HTMLInputElement>(null)

  // Build the queue once, when the session starts.
  useEffect(() => {
    if (!settings) return
    void Promise.all([window.api.vocab.list(), window.api.vocab.reviews(), window.api.decks.list()]).then(([all, logs, d]) => {
      const q = buildQueue(all, scope, settings, logs, new Date(), cram)
      setPool(all)
      setDecks(d)
      setQueue(q)
      setTotal(q.length)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings === null])

  const card = queue?.[0]
  const distinctTranslations = useMemo(() => new Set(pool.map((p) => p.translation.trim().toLowerCase()).filter(Boolean)).size, [pool])
  const mode: ReviewMode = useMemo(
    () => (card && settings ? pickMode(card, settings.reviewMode, distinctTranslations >= 4) : 'flashcard'),
    // A card re-queued after "Again" gets a fresh mode only when its review count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id, card?.srs.reps, settings?.reviewMode, distinctTranslations]
  )

  const options = useMemo(() => {
    if (!card || mode !== 'choice') return []
    const own = card.translation.trim().toLowerCase()
    const others = shuffle(pool.filter((p) => p.id !== card.id && p.translation.trim() && p.translation.trim().toLowerCase() !== own))
    others.sort((a, b) => (a.pos === card.pos ? 0 : 1) - (b.pos === card.pos ? 0 : 1))
    const seen = new Set([own])
    const picks: string[] = []
    for (const o of others) {
      const t = o.translation.trim()
      if (seen.has(t.toLowerCase())) continue
      seen.add(t.toLowerCase())
      picks.push(t)
      if (picks.length === 3) break
    }
    return shuffle([card.translation.trim(), ...picks])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, card?.srs.reps, mode])

  const cloze = card && mode === 'cloze' ? makeCloze(card.context, card.text) : null

  // Reset per card.
  useEffect(() => {
    if (!card) return
    setPhase('question')
    setInput('')
    setVerdict(null)
    setPicked(null)
    setHint(0)
    shownAt.current = Date.now()
    if (settings?.speakWords && (mode === 'flashcard' || mode === 'choice')) speak(card.text)
    if (mode === 'typing' || mode === 'cloze') setTimeout(() => inputRef.current?.focus(), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, card?.srs.reps, mode])

  const reveal = (): void => {
    if (!card || phase !== 'question') return
    if (mode === 'typing' || mode === 'cloze') {
      if (!input.trim()) return
      setVerdict(checkTyped(input, card.text))
      inputRef.current?.blur()
    }
    if (mode === 'choice' && picked === null) return
    setPhase('answer')
    if (settings?.speakWords && (mode === 'typing' || mode === 'cloze')) speak(card.text)
  }

  const choose = (i: number): void => {
    if (!card || phase !== 'question' || i >= options.length) return
    setPicked(i)
    setPhase('answer')
  }

  const suggested: SrsGrade =
    mode === 'flashcard' ? 3 : mode === 'choice' ? (picked !== null && options[picked] === card?.translation.trim() ? 3 : 1) : suggestedGrade(verdict ?? 'wrong')

  const grade = async (g: SrsGrade): Promise<void> => {
    if (!card || phase !== 'answer' || saving || !queue) return
    setSaving(true)
    const updated = await window.api.vocab.review(card.id, g, mode, Date.now() - shownAt.current)
    setSaving(false)
    setStats((s) => ({ ...s, reviewed: s.reviewed + 1, again: s.again + (g === 1 ? 1 : 0), newSeen: s.newSeen + (card.srs.state === 0 ? 1 : 0) }))
    const rest = queue.slice(1)
    const comesBackSoon = updated && new Date(updated.srs.due).getTime() - Date.now() < RESTUDY_MS
    if (updated && (comesBackSoon || (cram && g === 1))) {
      // Show it again later in this session, not immediately.
      const at = Math.min(rest.length, 3 + Math.floor(Math.random() * 3))
      rest.splice(at, 0, updated)
      setTotal((t) => t + 1)
    }
    setPool((p) => p.map((x) => (updated && x.id === updated.id ? updated : x)))
    setQueue(rest)
    bumpData()
  }

  const exit = (): void => navigate(back)

  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      exit()
      return
    }
    if (!card) {
      if (e.key === 'Enter') exit()
      return
    }
    const typing = isTyping(e)
    if (phase === 'question') {
      if ((e.key === 'Enter' || (e.key === ' ' && !typing)) && mode !== 'choice') {
        e.preventDefault()
        reveal()
      } else if (mode === 'choice' && !typing && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        choose(Number(e.key) - 1)
      }
      return
    }
    if (/^[1-4]$/.test(e.key) && !typing) {
      e.preventDefault()
      void grade(Number(e.key) as SrsGrade)
    } else if (e.key === 'Enter' || (e.key === ' ' && !typing)) {
      e.preventDefault()
      void grade(suggested)
    } else if (e.key.toLowerCase() === 's' && !typing) {
      speak(card.text)
    }
  })

  if (!settings || queue === null) return <div className="flex-1" />

  const title = scopeLabel(scope, decks)
  const doneCount = total - queue.length

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-no-translate>
      <header className="drag flex h-[64px] shrink-0 items-center gap-4 border-b px-6">
        <Button variant="ghost" size="sm" className="no-drag -ml-2 text-muted-foreground" onClick={exit}>
          <ArrowLeft /> Exit <Kbd className="ml-1">Esc</Kbd>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="truncate font-medium">
              {cram ? 'Practice' : 'Review'} · {title}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {queue.length ? `${queue.length} left` : 'done'}
            </span>
          </div>
          <Progress value={total ? (doneCount / total) * 100 : 100} className="mt-1.5" />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="no-drag"
          title={settings.speakWords ? 'Sound on' : 'Sound off'}
          onClick={() => void updateSettings({ speakWords: !settings.speakWords })}
        >
          {settings.speakWords ? <Volume2 /> : <VolumeX />}
        </Button>
      </header>

      {!card ? (
        <SessionEnd stats={stats} total={total} cram={cram} onBack={exit} onCram={() => navigate({ page: 'review', scope, cram: true, back })} title={title} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <motion.div
              key={`${card.id}-${card.srs.reps}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="mx-auto flex max-w-[640px] flex-col items-center px-8 pb-16 pt-12 text-center"
            >
              <div className="mb-6 flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="rounded-md bg-secondary px-1.5 py-0.5 font-medium">{MODE_LABEL[mode]}</span>
                {card.srs.state === 0 && <span className="rounded-md bg-sky-500/12 px-1.5 py-0.5 font-medium text-sky-600 dark:text-sky-400">New word</span>}
                {card.srs.lapses >= 2 && <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-400">Tricky</span>}
              </div>

              {/* ── Prompt ── */}
              {(mode === 'flashcard' || mode === 'choice' || phase === 'answer') && (
                <div className="mb-2">
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-[34px] font-semibold tracking-tight">{card.text}</h2>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Listen (S)" onClick={() => speak(card.text)}>
                      <Volume2 className="size-5" />
                    </button>
                  </div>
                  <div className="text-[13px] text-muted-foreground">{[card.ipa, card.pos, card.level].filter(Boolean).join(' · ')}</div>
                </div>
              )}

              {mode === 'typing' && phase === 'question' && (
                <div className="mb-6">
                  <p className="text-[13px] text-muted-foreground">How do you say it in English?</p>
                  <h2 className="mt-2 text-[30px] font-semibold tracking-tight">{card.translation}</h2>
                  <div className="text-[13px] text-muted-foreground">{[card.pos, card.level].filter(Boolean).join(' · ')}</div>
                </div>
              )}

              {mode === 'cloze' && cloze && phase === 'question' && (
                <div className="mb-6 w-full">
                  <p className="mb-4 text-[13px] text-muted-foreground">Fill the gap — the sentence where you found this word</p>
                  <p className="text-[20px] leading-[2.2]">
                    {cloze.before}
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                      style={{ width: `${Math.max(8, input.length + 2)}ch` }}
                      className="mx-1 inline-block h-10 rounded-lg border border-input bg-background px-2 align-middle text-[18px] font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {cloze.after}
                  </p>
                  <p className="mt-3 text-[14px] text-muted-foreground">
                    = <span className="font-medium text-foreground">{card.translation}</span>
                  </p>
                </div>
              )}

              {mode === 'typing' && phase === 'question' && (
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={hint ? card.text.slice(0, hint) + '…' : 'Type the English word or phrase'}
                  className="h-12 w-full max-w-[420px] rounded-xl border border-input bg-background px-4 text-center text-[18px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              )}

              {(mode === 'typing' || mode === 'cloze') && phase === 'question' && (
                <button
                  className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setHint((h) => Math.min(card.text.length, h + 1))
                    inputRef.current?.focus()
                  }}
                >
                  <Lightbulb className="size-3.5" />
                  {hint ? `Starts with “${card.text.slice(0, hint)}” · ${plural(card.text.split(/\s+/).length, 'word')} · more` : 'Hint'}
                </button>
              )}

              {mode === 'flashcard' && phase === 'question' && card.context && (
                <p className="mt-4 max-w-[520px] text-[15px] italic leading-relaxed text-muted-foreground">
                  <Highlighted context={card.context} text={card.text} />
                </p>
              )}

              {mode === 'choice' && (
                <div className="mt-6 grid w-full max-w-[480px] gap-2">
                  {options.map((o, i) => {
                    const correct = o === card.translation.trim()
                    const state = phase === 'question' ? 'idle' : correct ? 'correct' : picked === i ? 'wrong' : 'dim'
                    return (
                      <button
                        key={o}
                        disabled={phase === 'answer'}
                        onClick={() => choose(i)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors',
                          state === 'idle' && 'bg-card hover:border-primary/50 hover:bg-primary/[0.04]',
                          state === 'correct' && 'border-emerald-500/60 bg-emerald-500/10',
                          state === 'wrong' && 'border-destructive/60 bg-destructive/10',
                          state === 'dim' && 'opacity-50'
                        )}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border text-[12px] text-muted-foreground">
                          {state === 'correct' ? <Check className="size-3.5 text-emerald-600" /> : state === 'wrong' ? <X className="size-3.5 text-destructive" /> : i + 1}
                        </span>
                        {o}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* ── Answer ── */}
              {phase === 'answer' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 w-full">
                  {verdict && (
                    <div
                      className={cn(
                        'mx-auto mb-4 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13.5px] font-medium',
                        verdict === 'correct' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : verdict === 'typo' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {verdict === 'correct' ? <Check className="size-4" /> : <X className="size-4" />}
                      {verdict === 'correct' ? 'Correct!' : verdict === 'typo' ? 'Almost — check the spelling' : 'Not quite'}
                      {verdict !== 'correct' && <span className="font-normal opacity-80">· you wrote “{input.trim()}”</span>}
                    </div>
                  )}
                  {mode !== 'choice' && <p className="text-[22px] font-medium">{card.translation}</p>}
                  {card.context && (
                    <p className="mx-auto mt-4 max-w-[540px] text-[15px] italic leading-relaxed text-muted-foreground">
                      <Highlighted context={card.context} text={card.text} />
                    </p>
                  )}
                  {(card.examples?.length || card.note || card.explanation) && (
                    <div className="mx-auto mt-5 max-w-[540px] space-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-left text-[13.5px]">
                      {card.examples?.map((ex) => (
                        <p key={ex} className="leading-relaxed">
                          • <Highlighted context={ex} text={card.text} />
                        </p>
                      ))}
                      {card.note && <p className="text-muted-foreground">📝 {card.note}</p>}
                      {card.explanation && !card.examples?.length && <Markdown className="text-[13px] [&_p]:my-1">{card.explanation}</Markdown>}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          </div>

          <footer className="shrink-0 border-t px-6 py-3">
            {phase === 'question' ? (
              <div className="mx-auto flex max-w-[640px] items-center justify-center gap-3">
                {mode === 'choice' ? (
                  <span className="text-[12.5px] text-muted-foreground">Press 1–4 to choose</span>
                ) : (
                  <>
                    <Button size="lg" className="min-w-[220px]" onClick={reveal} disabled={(mode === 'typing' || mode === 'cloze') && !input.trim()}>
                      {mode === 'flashcard' ? 'Show answer' : 'Check'}
                    </Button>
                    <Kbd>{mode === 'flashcard' ? 'Space' : '↵'}</Kbd>
                  </>
                )}
              </div>
            ) : (
              <GradeBar card={card} retention={settings.desiredRetention} suggested={suggested} disabled={saving} onGrade={(g) => void grade(g)} />
            )}
          </footer>
        </>
      )}
    </div>
  )
}

function GradeBar({ card, retention, suggested, disabled, onGrade }: { card: VocabEntry; retention: number; suggested: SrsGrade; disabled: boolean; onGrade(g: SrsGrade): void }) {
  const now = new Date()
  const due = previewDue(card.srs, now, retention)
  return (
    <div className="mx-auto grid max-w-[640px] grid-cols-4 gap-2">
      {GRADES.map(({ g, label, className }) => (
        <button
          key={g}
          disabled={disabled}
          data-suggested={g === suggested}
          onClick={() => onGrade(g)}
          className={cn('flex flex-col items-center gap-0.5 rounded-xl border bg-card py-2 transition-colors disabled:opacity-60', className)}
        >
          <span className="text-[14px] font-semibold">{label}</span>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            {formatInterval(now, due[g])} · <Kbd className="h-4 min-w-4 text-[10px]">{g}</Kbd>
          </span>
        </button>
      ))}
      <p className="col-span-4 text-center text-[11.5px] text-muted-foreground">↵ accepts the highlighted grade · S plays the word</p>
    </div>
  )
}

function SessionEnd({ stats, total, cram, onBack, onCram, title }: { stats: SessionStats; total: number; cram?: boolean; onBack(): void; onCram(): void; title: string }) {
  const [tomorrow, setTomorrow] = useState<number | null>(null)
  useEffect(() => {
    void window.api.vocab.list().then((all) => {
      const end = new Date()
      end.setDate(end.getDate() + 1)
      end.setHours(23, 59, 59, 999)
      setTomorrow(all.filter((e) => !e.suspended && e.srs.state !== 0 && new Date(e.srs.due) <= end).length)
    })
  }, [])
  const minutes = Math.max(1, Math.round((Date.now() - stats.started) / 60000))
  const accuracy = stats.reviewed ? Math.round(((stats.reviewed - stats.again) / stats.reviewed) * 100) : 0

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-muted/50">
          <Clock className="size-5 text-muted-foreground" />
        </div>
        <h2 className="text-[18px] font-semibold">Nothing to review in “{title}” right now</h2>
        <p className="mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">All cards are scheduled for later, and today's new-card limit may be reached. You can still practise them.</p>
        <div className="mt-6 flex gap-2">
          <Button onClick={onCram}>Practise anyway</Button>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/12">
        <PartyPopper className="size-6 text-primary" />
      </motion.div>
      <h2 className="text-[22px] font-semibold tracking-tight">{cram ? 'Practice complete' : 'Done for now!'}</h2>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ['Cards', stats.reviewed],
          ['Remembered', `${accuracy}%`],
          ['Time', `${minutes} min`]
        ].map(([label, value]) => (
          <div key={label} className="min-w-[110px] rounded-xl border px-4 py-3">
            <div className="text-[22px] font-semibold tabular-nums">{value}</div>
            <div className="text-[12px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[13.5px] text-muted-foreground">
        {stats.newSeen > 0 && `${plural(stats.newSeen, 'new word')} learned. `}
        {tomorrow !== null && (tomorrow ? `${plural(tomorrow, 'card')} due by tomorrow.` : 'Nothing due tomorrow.')}
      </p>
      <Button className="mt-6" onClick={onBack}>
        Back to vocabulary <Kbd className="ml-1 border-white/30 bg-white/15 text-primary-foreground">↵</Kbd>
      </Button>
    </div>
  )
}
