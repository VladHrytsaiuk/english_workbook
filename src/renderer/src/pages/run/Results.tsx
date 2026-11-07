import { motion } from 'framer-motion'
import { ArrowLeft, Check, Clock, Languages, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { InlineMarkdown, Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Kbd } from '@/components/ui/kbd'
import { useKeydown } from '@/hooks/useHotkey'
import { type RunSession, useApp, useAsync } from '@/lib/store'
import { cn, pct } from '@/lib/utils'
import { findByWord } from '@shared/trouble'
import type { Attempt } from '@shared/types'
import { TYPE_LABEL } from './questions'

export function ScoreRing({ value, size = 132, stroke = 10 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = value >= 85 ? 'hsl(var(--success))' : value >= 60 ? 'hsl(var(--primary))' : value >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--secondary))" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-semibold tabular-nums tracking-tight">{value}%</span>
      </div>
    </div>
  )
}

function verdict(p: number): string {
  if (p === 100) return 'Perfect score!'
  if (p >= 85) return 'Excellent work'
  if (p >= 70) return 'Good job'
  if (p >= 50) return 'Getting there'
  return 'Keep practising'
}

export function Results({ session, attempt, onBack }: { session: RunSession; attempt: Attempt; onBack(): void }) {
  const { startSession } = useApp()
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [])
  const score = pct(attempt.correct, attempt.total)
  const mins = Math.max(1, Math.round((new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000))
  const byKey = useMemo(() => new Map(session.items.map((i) => [i.key, i])), [session.items])
  const mistakes = attempt.results.filter((r) => !r.correct)
  // Questions that name a vocabulary word (`word:` in the test) link the mistakes to the learner's words.
  const { navigate } = useApp()
  const { data: vocab } = useAsync(() => window.api.vocab.list())
  const wordsBehind = useMemo(() => {
    const found = mistakes.filter((m) => m.word).map((m) => findByWord(vocab ?? [], m.word as string))
    return [...new Map(found.filter((v): v is NonNullable<typeof v> => Boolean(v)).map((v) => [v.id, v])).values()]
  }, [vocab, mistakes])

  const topics = useMemo(() => {
    const m = new Map<string, { right: number; total: number }>()
    for (const r of attempt.results) {
      for (const t of r.topics) {
        const e = m.get(t) ?? { right: 0, total: 0 }
        e.total++
        if (r.correct) e.right++
        m.set(t, e)
      }
    }
    return [...m.entries()].sort((a, b) => pct(a[1].right, a[1].total) - pct(b[1].right, b[1].total))
  }, [attempt])

  const retryMistakes = (): void => {
    const items = mistakes.map((m) => byKey.get(m.key)).filter((i) => i !== undefined)
    if (!items.length) return
    startSession({ testId: session.testId, title: session.title.replace(/ · mistakes$/, '') + ' · mistakes', topics: session.topics, items, mode: 'retry' })
  }
  const retake = (): void => startSession({ ...session, mode: session.mode })

  useKeydown((e) => {
    if (e.metaKey || e.ctrlKey) return
    if (e.key.toLowerCase() === 'r' && mistakes.length) retryMistakes()
    else if (e.key === 'Escape') onBack()
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="drag flex h-[64px] shrink-0 items-center gap-3 border-b px-6">
        <Button variant="ghost" size="sm" className="no-drag -ml-2 text-muted-foreground" onClick={onBack}>
          <ArrowLeft /> Back to tests
        </Button>
        <span className="truncate text-[13px] font-medium">{session.title}</span>
      </header>
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="mx-auto max-w-[860px] px-8 pb-20 pt-10">
          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-8">
            <ScoreRing value={score} />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Sparkles className="size-4 text-primary" /> {attempt.mode === 'retry' ? 'Retry of mistakes' : attempt.mode === 'mistakes' ? 'Mistakes bank practice' : attempt.mode === 'topic' ? 'Topic practice' : attempt.mode === 'words' ? 'Word test complete' : 'Test complete'}
              </div>
              <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{verdict(score)}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">{attempt.correct}</span> of {attempt.total} correct
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {mins} min
                </span>
                {attempt.results.some((r) => r.overridden) && <span>{attempt.results.filter((r) => r.overridden).length} counted manually</span>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {mistakes.length > 0 && (
                  <Button onClick={retryMistakes}>
                    <RotateCcw /> Retry mistakes only ({mistakes.length}) <Kbd className="ml-1 border-white/30 bg-white/15 text-primary-foreground">R</Kbd>
                  </Button>
                )}
                <Button variant="outline" onClick={retake}>
                  Retake all
                </Button>
                <Button variant="ghost" onClick={onBack}>
                  Done
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Topics */}
          {topics.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">By topic</h2>
              <Card className="divide-y">
                {topics.map(([topic, s], i) => {
                  const p = pct(s.right, s.total)
                  return (
                    <div key={topic} className="flex items-center gap-4 px-5 py-3">
                      <span className="w-48 truncate text-[14px] font-medium">{topic}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <motion.div
                          className={cn('h-full rounded-full', p >= 85 ? 'bg-success' : p >= 60 ? 'bg-primary' : p >= 40 ? 'bg-warning' : 'bg-destructive')}
                          initial={{ width: 0 }}
                          animate={{ width: `${p}%` }}
                          transition={{ delay: 0.15 + i * 0.04, duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="w-20 text-right text-[13px] tabular-nums text-muted-foreground">
                        {s.right}/{s.total} · {p}%
                      </span>
                    </div>
                  )
                })}
              </Card>
            </section>
          )}

          {/* Words behind the mistakes */}
          {wordsBehind.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Words behind your mistakes ({wordsBehind.length})</h2>
              <Card className="p-5">
                <div className="flex flex-wrap gap-2">
                  {wordsBehind.map((w) => (
                    <span key={w.id} className="rounded-lg border bg-muted/40 px-2.5 py-1 text-[13.5px]">
                      <span className="font-medium">{w.text}</span>
                      {w.translation && <span className="ml-1.5 text-muted-foreground">{w.translation}</span>}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate({
                        page: 'review',
                        scope: { kind: 'ids', ids: wordsBehind.map((w) => w.id), label: 'Words from the test' },
                        cram: true,
                        back: { page: 'tests' }
                      })
                    }
                  >
                    <Languages /> Review these words
                  </Button>
                  <span className="text-[12.5px] text-muted-foreground">They are marked as difficult: you'll see them under Vocabulary → Difficult and they come up more often in word tests.</span>
                </div>
              </Card>
            </section>
          )}

          {/* Mistakes */}
          <section className="mt-12">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {mistakes.length ? `Mistakes (${mistakes.length})` : 'Mistakes'}
            </h2>
            {mistakes.length === 0 ? (
              <Card className="flex items-center gap-3 px-5 py-4 text-[14px]">
                <Check className="size-4 text-success" /> No mistakes — every answer was right.
              </Card>
            ) : (
              <div className="space-y-3">
                {mistakes.map((m) => {
                  const item = byKey.get(m.key)
                  return (
                    <Card key={m.key} className="selectable p-5" data-translate="test" data-source-title={session.title}>
                      <div className="mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span className="font-medium">{m.questionId}</span>·<span>{TYPE_LABEL[m.type]}</span>
                        {item?.reading && <Badge variant="outline">{item.reading.title}</Badge>}
                        {m.topics[0] && (
                          <Badge variant="secondary" className="ml-auto">
                            {m.topics[0]}
                          </Badge>
                        )}
                      </div>
                      {item && (
                        <p className="text-[15.5px] leading-relaxed">
                          <InlineMarkdown>{item.prompt}</InlineMarkdown>
                        </p>
                      )}
                      <div className="mt-3 grid gap-1.5 text-[14px]">
                        <div className="flex gap-2">
                          <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                          <span className="text-muted-foreground">{m.userAnswer || '—'}</span>
                        </div>
                        <div className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" />
                          <span className="font-medium">{m.correctAnswer}</span>
                        </div>
                      </div>
                      {item?.explain && (
                        <div className="mt-3 rounded-lg bg-muted/50 px-3.5 py-2.5">
                          <Markdown className="text-[13.5px] [&_p]:my-1">{item.explain}</Markdown>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
