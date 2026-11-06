import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Check, Flame, GraduationCap, Languages, ListChecks, Play, Sparkles, Target, TrendingDown } from 'lucide-react'
import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useApp, useAsync } from '@/lib/store'
import { dayKey, activityByDay, minutesFor, splitMistakes, streak, suggestedTest, weakTopic } from '@/lib/today'
import { cn, pct, plural, relativeTime } from '@/lib/utils'
import { ALL_SCOPE, buildQueue, speak, todayCounts } from '@/lib/vocab'
import { statusOf } from '@shared/srs'

function greeting(now: Date): string {
  const h = now.getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

interface PlanItem {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  done: boolean
  doneText?: string
  action?: { label: string; run(): void }
}

export function TodayPage() {
  const { settings, tests, navigate, startSession } = useApp()
  const { data: attempts } = useAsync(() => window.api.progress.attempts())
  const { data: bank } = useAsync(() => window.api.progress.mistakes())
  const { data: vocab } = useAsync(() => window.api.vocab.list())
  const { data: logs } = useAsync(() => window.api.vocab.reviews())
  const now = useMemo(() => new Date(), [attempts, vocab, logs])
  const ready = attempts && bank && vocab && logs && settings

  const view = useMemo(() => {
    if (!ready) return null
    const today = dayKey(now)
    const activity = activityByDay(attempts, logs)
    const todayAttempts = attempts.filter((a) => dayKey(a.finishedAt) === today)
    const queue = buildQueue(vocab, ALL_SCOPE, settings, logs, now)
    const { newSeen, reviews } = todayCounts(logs, now)
    const weak = weakTopic(attempts, tests, now)
    const suggestion = suggestedTest(tests, attempts, now)
    const plan: PlanItem[] = []

    // 1. Words
    if (!vocab.length) {
      plan.push({
        id: 'words',
        icon: Languages,
        title: 'Save your first words',
        detail: 'Open a note, select a word and press Save — it will come back for review at the right time.',
        done: false,
        action: { label: 'Open notes', run: () => navigate({ page: 'notes' }) }
      })
    } else {
      const studied = reviews + newSeen
      plan.push({
        id: 'words',
        icon: Languages,
        title: queue.length ? `Review ${plural(queue.length, 'word')}` : 'Words reviewed',
        detail: queue.length
          ? `${[queue.filter((e) => e.srs.state !== 0).length && `${queue.filter((e) => e.srs.state !== 0).length} due`, queue.filter((e) => e.srs.state === 0).length && `${queue.filter((e) => e.srs.state === 0).length} new`].filter(Boolean).join(' · ')} · about ${minutesFor(queue.length, 0)} min`
          : studied
            ? `${plural(studied, 'card')} today — nothing else is due.`
            : 'Nothing is due right now.',
        done: queue.length === 0,
        doneText: studied ? `${studied} done` : 'All caught up',
        action: queue.length ? { label: 'Start review', run: () => navigate({ page: 'review', scope: ALL_SCOPE, back: { page: 'today' } }) } : undefined
      })
    }

    // 2. Mistakes bank — questions already answered correctly today are done for today (their 2nd correct answer
    // comes on another day), including ones practised via "Retry mistakes only" on the results screen.
    const { toFix, retriedToday } = splitMistakes(bank, now)
    if (bank.length || todayAttempts.some((a) => a.mode === 'mistakes' || a.mode === 'retry')) {
      const halfway = toFix.filter((m) => m.streak >= 1).length
      plan.push({
        id: 'mistakes',
        icon: Target,
        title: toFix.length ? `Fix ${plural(toFix.length, 'mistake')}` : bank.length ? 'Mistakes practised' : 'Mistakes fixed',
        detail: toFix.length
          ? `Questions you got wrong${halfway ? ` · ${halfway} already have 1 of 2 correct` : ''} · a question leaves the bank after 2 correct answers in a row · about ${minutesFor(0, toFix.length)} min`
          : bank.length
            ? `${retriedToday.length ? `${plural(retriedToday.length, 'question')} answered correctly today. ` : ''}${plural(bank.length, 'question')} still need${bank.length === 1 ? 's' : ''} one more correct answer — they come back tomorrow.`
            : 'The mistakes bank is empty.',
        done: toFix.length === 0,
        doneText: bank.length ? 'Done for today' : 'Empty',
        action: toFix.length ? { label: 'Practise', run: () => startSession({ testId: 'mistakes-bank', title: 'Mistakes bank', topics: [], items: toFix.map((m) => m.item), mode: 'mistakes' }) } : undefined
      })
    }

    // 3. Weakest topic
    if (weak) {
      const practised = todayAttempts.some((a) => a.mode === 'topic' && a.testTitle.endsWith(weak.topic))
      plan.push({
        id: 'topic',
        icon: TrendingDown,
        title: `Practise ${weak.topic}`,
        detail: `Your weakest topic: ${weak.accuracy}% over ${plural(weak.answered, 'answer')} in 30 days · ${plural(weak.items.length, 'question')} from your tests`,
        done: practised,
        doneText: 'Practised today',
        action: {
          label: 'Practise',
          run: () => startSession({ testId: `topic:${weak.topic}`, title: `Topic · ${weak.topic}`, topics: [weak.topic], items: weak.items, mode: 'topic' })
        }
      })
    }

    // 4. A test
    const testToday = todayAttempts.some((a) => a.mode === 'full' && a.completed)
    if (suggestion || testToday) {
      plan.push({
        id: 'test',
        icon: ListChecks,
        title: testToday ? 'Test done' : suggestion?.lastAt ? `Revisit “${suggestion.test.title}”` : `Try “${suggestion?.test.title}”`,
        detail: testToday
          ? `${plural(todayAttempts.filter((a) => a.mode === 'full').length, 'test')} completed today.`
          : suggestion?.lastAt
            ? `Last taken ${relativeTime(suggestion.lastAt)} · ${plural(suggestion.test.items.length, 'question')}`
            : `Not taken yet · ${plural(suggestion?.test.items.length ?? 0, 'question')} · about ${minutesFor(0, suggestion?.test.items.length ?? 0)} min`,
        done: testToday,
        doneText: 'Done',
        action:
          !testToday && suggestion
            ? { label: 'Open', run: () => navigate({ page: 'tests', testId: suggestion.test.id }) }
            : undefined
      })
    }

    // Activity heatmap: last 12 weeks, Monday-first columns.
    const days: { key: string; date: Date; count: number }[] = []
    const end = new Date(now)
    const start = new Date(now)
    start.setDate(start.getDate() - 7 * 12 + 1)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const a = activity.get(dayKey(d))
      days.push({ key: dayKey(d), date: new Date(d), count: a ? a.reviews + a.answers : 0 })
    }

    const tomorrowEnd = new Date(now)
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
    tomorrowEnd.setHours(23, 59, 59, 999)
    const from30 = new Date(now.getTime() - 30 * 86_400_000).toISOString()
    const answers30 = attempts.filter((a) => a.finishedAt >= from30).flatMap((a) => a.results)

    return {
      plan,
      streak: streak(activity, now),
      todayCount: (activity.get(today)?.reviews ?? 0) + (activity.get(today)?.answers ?? 0),
      days,
      words: {
        total: vocab.length,
        mastered: vocab.filter((v) => !v.suspended && statusOf(v) === 'mastered').length,
        tomorrow: vocab.filter((v) => !v.suspended && v.srs.state !== 0 && new Date(v.srs.due) <= tomorrowEnd).length
      },
      tests: { done: attempts.filter((a) => a.mode === 'full' && a.completed).length, accuracy: answers30.length ? pct(answers30.filter((r) => r.correct).length, answers30.length) : null },
      recentWords: [...vocab].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
    }
  }, [ready, attempts, bank, vocab, logs, settings, tests, now, navigate, startSession])

  if (!view) return <div className="flex-1" />

  const done = view.plan.filter((p) => p.done).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="drag flex h-[64px] shrink-0 items-center justify-between border-b px-8">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight">{greeting(now)}</h1>
          <p className="text-[12.5px] text-muted-foreground">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium', view.streak ? 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400' : 'text-muted-foreground')} data-tour="streak">
          <Flame className="size-4" /> {view.streak ? `${plural(view.streak, 'day')} streak` : 'Start a streak today'}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[920px] space-y-6 px-8 py-7">
          {/* Plan */}
          <section data-tour="plan">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">Plan for today</h2>
                <p className="text-[12.5px] text-muted-foreground">
                  {view.plan.length ? (done === view.plan.length ? 'Everything is done — great job!' : `${done} of ${view.plan.length} done`) : 'Nothing planned yet.'}
                </p>
              </div>
              {view.plan.length > 0 && (
                <div className="flex w-40 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(done / view.plan.length) * 100}%` }} />
                  </div>
                  <span className="text-[12px] tabular-nums text-muted-foreground">{pct(done, view.plan.length)}%</span>
                </div>
              )}
            </div>
            <Card className="divide-y overflow-hidden">
              {view.plan.map((p, i) => {
                const Icon = p.icon
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn('flex items-center gap-4 px-5 py-4', p.done && 'bg-muted/30')}
                  >
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border-2', p.done ? 'border-success bg-success text-success-foreground' : 'border-border text-muted-foreground')}>
                      {p.done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-[14.5px] font-medium', p.done && 'text-muted-foreground')}>{p.title}</div>
                      <div className="truncate text-[12.5px] text-muted-foreground">{p.detail}</div>
                    </div>
                    {p.action && !p.done ? (
                      <Button size="sm" variant={i === view.plan.findIndex((x) => !x.done) ? 'default' : 'outline'} onClick={p.action.run}>
                        {p.id === 'words' || p.id === 'mistakes' || p.id === 'topic' ? <Play className="fill-current" /> : null}
                        {p.action.label}
                        {p.id === 'test' && <ArrowRight />}
                      </Button>
                    ) : (
                      p.done && <span className="text-[12px] text-success">{p.doneText}</span>
                    )}
                  </motion.div>
                )
              })}
              {!view.plan.length && (
                <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">Add notes, tests or words to your workbook to get a daily plan.</div>
              )}
            </Card>
          </section>

          {/* Activity + snapshot */}
          <section className="grid grid-cols-[1.4fr_1fr] gap-4">
            <Card className="p-5" data-tour="activity">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-[14px] font-semibold">Activity</h3>
                <span className="text-[12px] text-muted-foreground">{view.todayCount ? `${view.todayCount} today` : 'last 12 weeks'}</span>
              </div>
              <Heatmap days={view.days} />
            </Card>
            <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border p-0">
              {[
                { icon: Languages, label: 'Words saved', value: view.words.total },
                { icon: GraduationCap, label: 'Mastered', value: view.words.mastered },
                { icon: BookOpen, label: 'Due by tomorrow', value: view.words.tomorrow },
                { icon: Sparkles, label: 'Test accuracy · 30d', value: view.tests.accuracy === null ? '—' : `${view.tests.accuracy}%` }
              ].map((t) => (
                <div key={t.label} className="bg-card px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <t.icon className="size-3.5" /> {t.label}
                  </div>
                  <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight">{t.value}</div>
                </div>
              ))}
            </Card>
          </section>

          {/* Recent words */}
          {view.recentWords.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[14px] font-semibold">Recently saved words</h3>
                <button className="text-[12.5px] text-primary hover:underline" onClick={() => navigate({ page: 'vocab' })}>
                  Open vocabulary
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {view.recentWords.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => speak(w.text)}
                    title="Listen"
                    className="group rounded-lg border bg-card px-3 py-1.5 text-left transition-colors hover:border-primary/40"
                  >
                    <span className="text-[13.5px] font-medium">{w.text}</span>
                    {w.translation && <span className="ml-1.5 text-[12.5px] text-muted-foreground">{w.translation}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Heatmap({ days }: { days: { key: string; date: Date; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const weeks: (typeof days)[] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  const level = (c: number): string => (c === 0 ? 'bg-secondary' : c / max < 0.25 ? 'bg-primary/25' : c / max < 0.5 ? 'bg-primary/45' : c / max < 0.75 ? 'bg-primary/70' : 'bg-primary')
  const today = dayKey(new Date())
  return (
    <div>
      <div className="flex gap-[3px]">
        <div className="mr-1 flex flex-col justify-between py-[1px] text-[10px] leading-none text-muted-foreground">
          <span>Mon</span>
          <span>Thu</span>
          <span>Sun</span>
        </div>
        {weeks.map((w) => (
          <div key={w[0].key} className="flex flex-col gap-[3px]">
            {w.map((d) => (
              <div
                key={d.key}
                title={`${d.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: ${d.count ? plural(d.count, 'activity', 'activities') : 'no activity'}`}
                className={cn('size-[13px] rounded-[3px]', level(d.count), d.key === today && 'ring-1 ring-foreground/40')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10.5px] text-muted-foreground">
        Less
        {['bg-secondary', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'].map((c) => (
          <span key={c} className={cn('size-[10px] rounded-[2px]', c)} />
        ))}
        More
      </div>
    </div>
  )
}
