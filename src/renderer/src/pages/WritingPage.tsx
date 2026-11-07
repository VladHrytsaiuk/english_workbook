import { motion } from 'framer-motion'
import { Check, FolderOpen, MessageSquare, PenLine, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useApp, useAsync } from '@/lib/store'
import { cn, formatDate, plural, relativeTime } from '@/lib/utils'
import { CHAT_SCENARIOS, type ChatScenario } from '@shared/chatScenarios'
import type { WritingEntry } from '@shared/types'
import { countWords, mistakeStats } from '@shared/writing'
import { monthKey, taskForMonth } from '@shared/writingTasks'
import { CATEGORY_LABEL } from './writing/EvaluationView'
import { ChatView } from './writing/ChatView'
import { EssayView } from './writing/EssayView'
import { StartChatDialog, StartEssayDialog } from './writing/StartDialogs'

export function WritingPage() {
  const { route } = useApp()
  const entryId = route.page === 'writing' ? route.entryId : undefined
  const { data: entries } = useAsync(() => window.api.writing.list())
  const entry = entryId ? entries?.find((e) => e.id === entryId) : undefined
  if (entryId) {
    if (!entries) return <div className="flex-1" />
    if (!entry) return <MissingEntry />
    return entry.kind === 'essay' ? <EssayView key={entry.id} entry={entry} /> : <ChatView key={entry.id} entry={entry} />
  }
  return <Hub entries={entries ?? []} loaded={Boolean(entries)} />
}

function MissingEntry() {
  const { navigate } = useApp()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-[14px] text-muted-foreground">This text no longer exists.</p>
      <Button onClick={() => navigate({ page: 'writing' })}>Back to Writing</Button>
    </div>
  )
}

function ScoreBadge({ e }: { e: WritingEntry }) {
  if (!e.evaluation) return <Badge variant="outline">draft</Badge>
  const p = e.evaluation.overall
  return (
    <Badge variant={p >= 80 ? 'success' : p >= 60 ? 'default' : p >= 40 ? 'warning' : 'destructive'}>
      {p}%{e.evaluation.cefr ? ` · ${e.evaluation.cefr}` : ''}
    </Badge>
  )
}

function Hub({ entries, loaded }: { entries: WritingEntry[]; loaded: boolean }) {
  const { route, navigate, bumpData, toast } = useApp()
  const { data: vocab } = useAsync(() => window.api.vocab.list())
  const [essayOpen, setEssayOpen] = useState(route.page === 'writing' && route.start === 'essay')
  const [chat, setChat] = useState<ChatScenario | 'custom' | null>(null)
  const [allScenarios, setAllScenarios] = useState(false)

  const month = monthKey()
  const monthEssay = entries.find((e) => e.kind === 'essay' && e.month === month)
  const evaluated = useMemo(() => entries.filter((e) => e.evaluation).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [entries])
  const mistakes = useMemo(() => mistakeStats(evaluated.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 120 * 86_400_000)), [evaluated])
  const suggested = taskForMonth(month)
  const scenarios = allScenarios ? CHAT_SCENARIOS : CHAT_SCENARIOS.slice(0, 6)
  const chartData = evaluated.map((e) => ({ label: formatDate(e.createdAt, { day: 'numeric', month: 'short' }), score: e.evaluation?.overall ?? 0, title: e.title, kind: e.kind }))

  const remove = async (e: WritingEntry): Promise<void> => {
    await window.api.writing.remove(e.id)
    bumpData()
    toast(`Deleted “${e.title}”`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Writing"
        subtitle="A text every month and conversations for practice"
        actions={
          <Button variant="ghost" size="icon-sm" title="Open the writing folder" onClick={() => void window.api.content.openFolder('writing')}>
            <FolderOpen />
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] space-y-9 px-8 py-7" data-tour="writing-hub">
          {/* Writing of the month */}
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Writing of the month</h2>
            <Card className="flex items-center gap-5 p-5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <PenLine className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                {monthEssay ? (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[15px] font-semibold">{monthEssay.title}</h3>
                      <ScoreBadge e={monthEssay} />
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {monthEssay.status === 'evaluated' ? `Done on ${formatDate(monthEssay.updatedAt)} — you can write another text any time.` : `Draft · ${plural(countWords(monthEssay.text), 'word')} so far`}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-[15px] font-semibold">This month: {suggested.title}</h3>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">120–200 words · an AI checks it and shows your mistakes with explanations</p>
                  </>
                )}
              </div>
              {monthEssay ? (
                <div className="flex gap-2">
                  <Button variant={monthEssay.status === 'draft' ? 'default' : 'outline'} onClick={() => navigate({ page: 'writing', entryId: monthEssay.id })}>
                    {monthEssay.status === 'draft' ? 'Continue' : 'View feedback'}
                  </Button>
                  {monthEssay.status === 'evaluated' && (
                    <Button variant="ghost" onClick={() => setEssayOpen(true)}>
                      <Plus /> Another text
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={() => setEssayOpen(true)}>Start writing</Button>
              )}
            </Card>
          </section>

          {/* Correspondence */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Correspondence</h2>
              <span className="text-[12.5px] text-muted-foreground">Write to an AI in a real-life situation</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {scenarios.map((s, i) => (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.025, 0.25) }}
                  onClick={() => setChat(s)}
                  className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-px hover:border-foreground/15 hover:shadow-md"
                >
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium leading-snug">{s.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted-foreground">{s.description}</span>
                    <Badge variant="outline" className="mt-2">
                      {s.register}
                    </Badge>
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4">
              {!allScenarios && CHAT_SCENARIOS.length > 6 && (
                <button className="text-[13px] text-primary hover:underline" onClick={() => setAllScenarios(true)}>
                  Show all {CHAT_SCENARIOS.length} situations
                </button>
              )}
              <button className="flex items-center gap-1 text-[13px] text-primary hover:underline" onClick={() => setChat('custom')}>
                <Plus className="size-3.5" /> Your own situation
              </button>
            </div>
          </section>

          {/* Progress */}
          {evaluated.length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Your progress</h2>
              <div className="grid grid-cols-[1.5fr_1fr] gap-4">
                <Card className="p-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-[13.5px] font-semibold">Scores</h3>
                    <span className="text-[12px] text-muted-foreground">{plural(evaluated.length, 'text')} checked</span>
                  </div>
                  {evaluated.length >= 2 ? (
                    <div className="h-[150px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                          <defs>
                            <linearGradient id="writing-fill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" className="[stop-color:hsl(var(--primary))] [stop-opacity:0.22]" />
                              <stop offset="100%" className="[stop-color:hsl(var(--primary))] [stop-opacity:0]" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ className: 'fill-muted-foreground text-[11px]' }} minTickGap={24} />
                          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} tick={{ className: 'fill-muted-foreground text-[11px]' }} />
                          <ChartTooltip
                            cursor={{ className: 'stroke-muted-foreground/40', strokeWidth: 1 }}
                            content={({ active, payload }) => {
                              const d = payload?.[0]?.payload as (typeof chartData)[number] | undefined
                              if (!active || !d) return null
                              return (
                                <div className="rounded-lg border bg-popover px-3 py-2 text-[12px] shadow-md">
                                  <div className="font-medium">{d.title}</div>
                                  <div className="text-muted-foreground">
                                    {d.label} · <span className="font-semibold text-foreground">{d.score}%</span>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Area type="monotone" dataKey="score" className="[&_.recharts-area-curve]:stroke-primary" strokeWidth={2} fill="url(#writing-fill)" dot={{ r: 3.5, strokeWidth: 2, className: 'fill-card stroke-primary' }} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[150px] flex-col items-center justify-center text-center">
                      <div className="text-[34px] font-semibold tabular-nums">{evaluated[0].evaluation?.overall}</div>
                      <div className="text-[12.5px] text-muted-foreground">your first result — the chart appears after the second text</div>
                    </div>
                  )}
                </Card>
                <Card className="p-5">
                  <h3 className="mb-3 text-[13.5px] font-semibold">Most common mistakes</h3>
                  {mistakes.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No mistakes were marked in the last months.</p>
                  ) : (
                    <div className="space-y-2">
                      {mistakes.slice(0, 5).map((m) => (
                        <div key={m.category} className="grid grid-cols-[96px_1fr_24px] items-center gap-2 text-[13px]">
                          <span>{CATEGORY_LABEL[m.category]}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-warning" style={{ width: `${(m.count / mistakes[0].count) * 100}%` }} />
                          </div>
                          <span className="text-right tabular-nums text-muted-foreground">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </section>
          )}

          {/* History */}
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">History</h2>
            {!loaded ? null : entries.length === 0 ? (
              <Card className="px-5 py-8 text-center text-[13.5px] text-muted-foreground">Your texts and conversations will appear here.</Card>
            ) : (
              <Card className="divide-y">
                {entries.map((e) => (
                  <div key={e.id} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => navigate({ page: 'writing', entryId: e.id })}>
                      {e.kind === 'essay' ? <PenLine className="size-4 shrink-0 text-muted-foreground" /> : <MessageSquare className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{e.title}</span>
                        <span className="block text-[12px] text-muted-foreground">
                          {e.kind === 'essay' ? `Essay · ${plural(countWords(e.text), 'word')}` : `Conversation · ${plural(e.messages.filter((m) => m.role === 'user').length, 'message')}`} · {relativeTime(e.updatedAt)}
                        </span>
                      </span>
                      <ScoreBadge e={e} />
                    </button>
                    <button className={cn('rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100')} title="Delete" onClick={() => void remove(e)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </Card>
            )}
            {evaluated.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Check className="size-3.5" /> A readable copy of every checked text is saved in the <code className="rounded bg-muted px-1">writing/</code> folder of your workbook.
              </p>
            )}
          </section>
        </div>
      </div>

      <StartEssayDialog open={essayOpen} onClose={() => setEssayOpen(false)} vocab={vocab ?? []} />
      <StartChatDialog scenario={chat} onClose={() => setChat(null)} vocab={vocab ?? []} />
    </div>
  )
}
