import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Flame, ListChecks, Target, Trash2, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/EmptyState'
import { InlineMarkdown } from '@/components/Markdown'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useApp, useAsync } from '@/lib/store'
import { cn, formatDate, pct, plural, relativeTime } from '@/lib/utils'
import type { Attempt } from '@shared/types'
import { TYPE_LABEL } from './run/questions'
import { VocabStats } from './stats/VocabStats'

type Range = '30' | '90' | 'all'
const DAY = 86_400_000

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Consecutive days (ending today or yesterday) with at least one attempt. */
function studyStreak(attempts: Attempt[]): number {
  const days = new Set(attempts.map((a) => dayKey(a.finishedAt)))
  let streak = 0
  let t = Date.now()
  if (!days.has(dayKey(new Date(t).toISOString()))) t -= DAY
  while (days.has(dayKey(new Date(t).toISOString()))) {
    streak++
    t -= DAY
  }
  return streak
}

export function StatsPage() {
  const { startSession, bumpData, navigate } = useApp()
  const { data: attempts } = useAsync(() => window.api.progress.attempts())
  const { data: bank } = useAsync(() => window.api.progress.mistakes())
  const { data: vocab } = useAsync(() => window.api.vocab.list())
  const { data: vocabLogs } = useAsync(() => window.api.vocab.reviews())
  const [range, setRange] = useState<Range>('30')

  const filtered = useMemo(() => {
    if (!attempts) return []
    if (range === 'all') return attempts
    const from = Date.now() - Number(range) * DAY
    return attempts.filter((a) => new Date(a.finishedAt).getTime() >= from)
  }, [attempts, range])

  const totals = useMemo(() => {
    const answered = filtered.reduce((s, a) => s + a.results.length, 0)
    const correct = filtered.reduce((s, a) => s + a.results.filter((r) => r.correct).length, 0)
    const tests = filtered.filter((a) => a.completed && a.mode === 'full').length
    return { answered, correct, tests, accuracy: pct(correct, answered) }
  }, [filtered])

  const series = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>()
    for (const a of filtered) {
      const k = dayKey(a.finishedAt)
      const e = m.get(k) ?? { correct: 0, total: 0 }
      e.total += a.results.length
      e.correct += a.results.filter((r) => r.correct).length
      m.set(k, e)
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, label: formatDate(day, { day: 'numeric', month: 'short' }), accuracy: pct(v.correct, v.total), questions: v.total }))
  }, [filtered])

  const topics = useMemo(() => {
    const m = new Map<string, { right: number; total: number }>()
    for (const a of filtered)
      for (const r of a.results)
        for (const t of r.topics) {
          const e = m.get(t) ?? { right: 0, total: 0 }
          e.total++
          if (r.correct) e.right++
          m.set(t, e)
        }
    return [...m.entries()].map(([topic, v]) => ({ topic, ...v, p: pct(v.right, v.total) })).sort((a, b) => a.p - b.p || b.total - a.total)
  }, [filtered])

  const practice = (): void => {
    if (!bank?.length) return
    startSession({ testId: 'mistakes-bank', title: 'Mistakes bank', topics: [], items: bank.map((m) => m.item), mode: 'mistakes' })
  }

  if (attempts && attempts.length === 0 && bank?.length === 0 && vocab?.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Stats" />
        <EmptyState icon={BarChart3} title="No results yet" className="flex-1" action={<Button onClick={() => navigate({ page: 'tests' })}>Go to tests</Button>}>
          Finish a test and your accuracy, weak topics and mistakes will show up here.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Stats"
        subtitle={attempts ? `${plural(attempts.length, 'attempt')} in total` : undefined}
        actions={
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            {(
              [
                ['30', '30 days'],
                ['90', '90 days'],
                ['all', 'All time']
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setRange(v)}
                className={cn('h-7 rounded-md px-3 text-[12.5px] font-medium transition-colors', range === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1000px] space-y-8 px-8 py-6">
          {/* Tiles */}
          <div className="grid grid-cols-4 gap-3" data-tour="stats">
            <Tile icon={ListChecks} label="Tests completed" value={totals.tests} />
            <Tile icon={TrendingUp} label="Accuracy" value={totals.answered ? `${totals.accuracy}%` : '—'} sub={`${totals.correct} of ${totals.answered} answers`} />
            <Tile icon={Flame} label="Study streak" value={attempts ? plural(studyStreak(attempts), 'day') : '—'} />
            <Tile icon={Target} label="Mistakes bank" value={bank?.length ?? 0} sub="questions to master" />
          </div>

          {/* Over time */}
          <Card className="p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[14px] font-semibold">Accuracy over time</h2>
              <span className="text-[12px] text-muted-foreground">per day, all question types</span>
            </div>
            {series.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-muted-foreground">No attempts in this period.</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="acc-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.22]" />
                        <stop offset="100%" className="[stop-color:hsl(var(--primary))] [stop-opacity:0]" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ className: 'fill-muted-foreground text-[11px]' }} minTickGap={24} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={{ className: 'fill-muted-foreground text-[11px]' }} />
                    <ChartTooltip
                      cursor={{ className: 'stroke-muted-foreground/40', strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        const d = payload?.[0]?.payload as (typeof series)[number] | undefined
                        if (!active || !d) return null
                        return (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-[12px] shadow-md">
                            <div className="font-medium">{formatDate(d.day)}</div>
                            <div className="mt-0.5 text-muted-foreground">
                              <span className="font-semibold text-foreground">{d.accuracy}%</span> · {plural(d.questions, 'answer')}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      className="[&_.recharts-area-curve]:stroke-primary"
                      strokeWidth={2}
                      fill="url(#acc-fill)"
                      dot={{ r: 4, strokeWidth: 2, className: 'fill-card stroke-primary' }}
                      activeDot={{ r: 5, strokeWidth: 2, className: 'fill-primary stroke-card' }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Topics */}
          <Card className="p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[14px] font-semibold">Accuracy by topic</h2>
              <span className="text-[12px] text-muted-foreground">weakest first</span>
            </div>
            {topics.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">No answers in this period.</p>
            ) : (
              <div className="space-y-1">
                {topics.map((t, i) => (
                  <div key={t.topic} className="group grid grid-cols-[180px_1fr_90px] items-center gap-4 rounded-md px-2 py-1.5 hover:bg-muted/50" title={`${t.topic}: ${t.right} of ${t.total} correct`}>
                    <span className="truncate text-[13.5px]">{t.topic}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(t.p, 1.5)}%` }}
                        transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-right text-[12.5px] tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{t.p}%</span> · {t.right}/{t.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {vocab && vocabLogs && <VocabStats entries={vocab} logs={vocabLogs} />}

          {/* Mistakes bank */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold">Mistakes bank</h2>
                <p className="text-[12.5px] text-muted-foreground">Every question you got wrong. It leaves the bank after 2 correct answers in a row.</p>
              </div>
              <Button disabled={!bank?.length} onClick={practice}>
                <Target /> Practice {bank?.length ? `(${bank.length})` : ''}
              </Button>
            </div>
            {bank && bank.length === 0 ? (
              <Card className="px-5 py-6 text-center text-[13px] text-muted-foreground">The bank is empty — nothing to fix right now. 🎉</Card>
            ) : (
              <Card className="divide-y">
                <AnimatePresence initial={false}>
                  {bank?.map((m) => (
                    <motion.div key={m.key} layout exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px]">
                          <InlineMarkdown>{m.item.prompt}</InlineMarkdown>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                          <span className="truncate">{m.item.testTitle}</span>·<span>{TYPE_LABEL[m.item.type]}</span>
                          {m.item.topics[0] && <Badge variant="secondary">{m.item.topics[0]}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5" title={`${m.streak} of 2 correct in a row`}>
                        {[0, 1].map((i) => (
                          <span key={i} className={cn('size-2 rounded-full', i < m.streak ? 'bg-primary' : 'bg-secondary ring-1 ring-border')} />
                        ))}
                        <span className="ml-1 w-8 text-[11.5px] tabular-nums text-muted-foreground">{m.streak}/2</span>
                      </div>
                      <span className="w-20 text-right text-[12px] text-muted-foreground">
                        wrong ×{m.wrongCount}
                        <br />
                        {relativeTime(m.lastWrongAt)}
                      </span>
                      <button
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                        title="Remove from bank"
                        onClick={async () => {
                          await window.api.progress.removeMistake(m.key)
                          bumpData()
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Card>
            )}
          </section>

          {/* Recent */}
          {filtered.length > 0 && (
            <section>
              <h2 className="mb-3 text-[14px] font-semibold">Recent attempts</h2>
              <Card className="divide-y">
                {[...filtered]
                  .reverse()
                  .slice(0, 10)
                  .map((a) => (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-2.5 text-[13.5px]">
                      <span className="w-32 text-muted-foreground">{relativeTime(a.finishedAt)}</span>
                      <span className="min-w-0 flex-1 truncate">{a.testTitle}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {a.mode === 'full' ? 'Full' : a.mode === 'retry' ? 'Retry' : a.mode === 'topic' ? 'Topic' : a.mode === 'words' ? 'Words' : 'Mistakes'}
                        {!a.completed && ' · unfinished'}
                      </span>
                      <span className="w-14 text-right tabular-nums text-muted-foreground">
                        {a.correct}/{a.total}
                      </span>
                      <span className="w-11 text-right font-medium tabular-nums">{pct(a.correct, a.total)}%</span>
                    </div>
                  ))}
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Tile({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[11.5px] text-muted-foreground">{sub}</div>}
    </Card>
  )
}
