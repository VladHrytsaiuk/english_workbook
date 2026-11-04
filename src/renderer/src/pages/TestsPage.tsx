import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ChevronRight, CircleAlert, ExternalLink, FolderOpen, ListChecks, Play, RotateCcw, Target } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Kbd } from '@/components/ui/kbd'
import { useKeydown } from '@/hooks/useHotkey'
import { useApp, useAsync } from '@/lib/store'
import { cn, pct, plural, relativeTime } from '@/lib/utils'
import type { Attempt, MistakeEntry, ParsedTest } from '@shared/types'
import { TYPE_LABEL } from './run/questions'

function lastAttempt(attempts: Attempt[] | undefined, testId: string): Attempt | undefined {
  return attempts?.filter((a) => a.testId === testId && a.completed && a.mode === 'full').at(-1)
}

function ScoreBadge({ a }: { a: Attempt }) {
  const p = pct(a.correct, a.total)
  return <Badge variant={p >= 85 ? 'success' : p >= 60 ? 'default' : p >= 40 ? 'warning' : 'destructive'}>{p}%</Badge>
}

export function TestsPage() {
  const { route } = useApp()
  const testId = route.page === 'tests' ? route.testId : undefined
  return testId ? <TestDetail testId={testId} /> : <TestList />
}

function TestList() {
  const { tests, navigate, contentLoaded, startSession } = useApp()
  const { data: attempts } = useAsync(() => window.api.progress.attempts())
  const { data: mistakes } = useAsync(() => window.api.progress.mistakes())
  const totalQ = tests.reduce((s, t) => s + t.items.length, 0)

  const practiceBank = (): void => {
    if (!mistakes?.length) return
    startSession({ testId: 'mistakes-bank', title: 'Mistakes bank', topics: [], items: mistakes.map((m) => m.item), mode: 'mistakes' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Tests"
        subtitle={tests.length ? `${plural(tests.length, 'test')} · ${plural(totalQ, 'question')}` : undefined}
        actions={
          <>
            {mistakes && mistakes.length > 0 && (
              <Button variant="outline" size="sm" onClick={practiceBank}>
                <Target /> Practice mistakes ({mistakes.length})
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" title="Open tests folder" onClick={() => void window.api.content.openFolder()}>
              <FolderOpen />
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {contentLoaded && !tests.length ? (
          <EmptyState
            icon={ListChecks}
            title="No tests yet"
            className="h-full"
            action={
              <Button variant="outline" onClick={() => void window.api.content.openFolder()}>
                <FolderOpen /> Open workbook folder
              </Button>
            }
          >
            Put <code className="rounded bg-muted px-1">.md</code> test files in the <code className="rounded bg-muted px-1">tests/</code> folder. The format is described in{' '}
            <code className="rounded bg-muted px-1">TEST_FORMAT.md</code> in your workbook folder.
          </EmptyState>
        ) : (
          <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-3 px-8 py-6 xl:grid-cols-2" data-tour="tests-list">
            {tests.map((t, i) => (
              <TestCard key={t.id} test={t} index={i} last={lastAttempt(attempts, t.id)} onOpen={() => navigate({ page: 'tests', testId: t.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TestCard({ test, last, onOpen, index }: { test: ParsedTest; last?: Attempt; onOpen(): void; index: number }) {
  const errors = test.issues.filter((i) => i.severity === 'error').length
  const types = new Set(test.blocks.map((b) => b.type))
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onOpen}
      className="group flex flex-col rounded-xl border bg-card p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-px hover:border-foreground/15 hover:shadow-md"
    >
      <div className="flex w-full items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{test.title}</h3>
            {errors > 0 && (
              <Badge variant="destructive">
                <CircleAlert className="size-3" /> {errors} {errors === 1 ? 'error' : 'errors'}
              </Badge>
            )}
          </div>
          {test.description && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{test.description}</p>}
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </div>
      {test.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {test.topics.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
          {test.topics.length > 4 && <Badge variant="outline">+{test.topics.length - 4}</Badge>}
        </div>
      )}
      <div className="mt-4 flex w-full items-center gap-3 text-[12.5px] text-muted-foreground">
        <span>{plural(test.items.length, 'question')}</span>
        <span>·</span>
        <span>{plural(types.size, 'type')}</span>
        {test.level && (
          <>
            <span>·</span>
            <span>{test.level}</span>
          </>
        )}
        <span className="ml-auto flex items-center gap-2">
          {last ? (
            <>
              {relativeTime(last.finishedAt)} <ScoreBadge a={last} />
            </>
          ) : (
            <span className="text-primary">New</span>
          )}
        </span>
      </div>
    </motion.button>
  )
}

function TestDetail({ testId }: { testId: string }) {
  const { tests, navigate, startSession } = useApp()
  const test = tests.find((t) => t.id === testId)
  const { data: attempts } = useAsync(() => window.api.progress.attempts())
  const { data: bank } = useAsync(() => window.api.progress.mistakes())

  const history = useMemo(() => (attempts ?? []).filter((a) => a.testId === testId).reverse(), [attempts, testId])
  const testMistakes: MistakeEntry[] = useMemo(() => (bank ?? []).filter((m) => m.item.testId === testId), [bank, testId])

  const start = (): void => {
    if (!test?.items.length) return
    startSession({ testId: test.id, title: test.title, topics: test.topics, items: test.items, mode: 'full' })
  }
  const practiceMistakes = (): void => {
    if (!test || !testMistakes.length) return
    const current = new Map(test.items.map((i) => [i.key, i]))
    startSession({
      testId: test.id,
      title: `${test.title} · mistakes`,
      topics: test.topics,
      items: testMistakes.map((m) => current.get(m.key) ?? m.item),
      mode: 'mistakes'
    })
  }

  useKeydown((e) => {
    if (e.key === 'Enter' && !e.metaKey) {
      e.preventDefault()
      start()
    } else if (e.key === 'Escape' || (e.key === 'ArrowLeft' && e.metaKey)) navigate({ page: 'tests' })
  })

  if (!test) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Test not found" />
        <EmptyState icon={ListChecks} title="This test file is gone" action={<Button onClick={() => navigate({ page: 'tests' })}>Back to tests</Button>}>
          It may have been renamed or deleted.
        </EmptyState>
      </div>
    )
  }

  const errors = test.issues.filter((i) => i.severity === 'error')
  const warnings = test.issues.filter((i) => i.severity === 'warning')
  const typeCounts = new Map<string, number>()
  for (const i of test.items) typeCounts.set(TYPE_LABEL[i.type], (typeCounts.get(TYPE_LABEL[i.type]) ?? 0) + 1)
  const readingCount = test.blocks.filter((b) => b.type === 'reading').length
  const best = history.filter((a) => a.completed && a.mode === 'full').reduce((m, a) => Math.max(m, pct(a.correct, a.total)), -1)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="drag flex h-[64px] shrink-0 items-center gap-3 border-b px-6">
        <Button variant="ghost" size="sm" className="no-drag -ml-2 text-muted-foreground" onClick={() => navigate({ page: 'tests' })}>
          <ArrowLeft /> Tests
        </Button>
        <span className="text-muted-foreground/50">/</span>
        <span className="truncate text-[13px] font-medium">{test.title}</span>
        <div className="no-drag ml-auto flex gap-1">
          <Button variant="ghost" size="icon-sm" title="Open file in editor" onClick={() => void window.api.content.openFile('tests', test.id)}>
            <ExternalLink />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Show in Finder" onClick={() => void window.api.content.revealFile('tests', test.id)}>
            <FolderOpen />
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-8 pb-20 pt-10">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-[12.5px] text-muted-foreground">tests/{test.id}</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight">{test.title}</h1>
            {test.description && <p className="selectable mt-2 max-w-[640px] text-[15px] leading-relaxed text-muted-foreground">{test.description}</p>}
            {test.topics.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {test.topics.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[12px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={start} disabled={!test.items.length}>
                <Play className="fill-current" />
                {errors.length && test.items.length ? `Start with ${plural(test.items.length, 'valid question')}` : 'Start test'}
                <Kbd className="ml-1 border-white/30 bg-white/15 text-primary-foreground">↵</Kbd>
              </Button>
              {testMistakes.length > 0 && (
                <Button size="lg" variant="outline" onClick={practiceMistakes}>
                  <RotateCcw /> Practice {testMistakes.length} {testMistakes.length === 1 ? 'mistake' : 'mistakes'}
                </Button>
              )}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <Stat label="Questions" value={test.items.length} sub={readingCount ? `incl. ${readingCount} reading ${readingCount === 1 ? 'block' : 'blocks'}` : undefined} />
              <Stat label="Attempts" value={history.length} sub={history[0] ? `last ${relativeTime(history[0].finishedAt)}` : 'not taken yet'} />
              <Stat label="Best score" value={best >= 0 ? `${best}%` : '—'} />
            </div>
          </motion.div>

          {(errors.length > 0 || warnings.length > 0) && <IssuesPanel test={test} />}

          <section className="mt-10">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Question types</h2>
            <div className="flex flex-wrap gap-2">
              {[...typeCounts.entries()].map(([label, n]) => (
                <span key={label} className="rounded-lg border bg-card px-3 py-1.5 text-[13px]">
                  {label} <span className="ml-1 tabular-nums text-muted-foreground">{n}</span>
                </span>
              ))}
            </div>
          </section>

          {history.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
              <Card className="divide-y">
                {history.slice(0, 8).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 text-[13.5px]">
                    <span className="w-36 text-muted-foreground">{new Date(a.finishedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex-1">
                      {a.mode === 'full' ? 'Full test' : a.mode === 'retry' ? 'Retry of mistakes' : a.mode === 'topic' ? 'Topic practice' : 'Mistakes practice'}
                      {!a.completed && <span className="text-muted-foreground"> · unfinished</span>}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {a.correct}/{a.total}
                    </span>
                    <ScoreBadge a={a} />
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

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[22px] font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[11.5px] text-muted-foreground">{sub}</div>}
    </Card>
  )
}

function IssuesPanel({ test }: { test: ParsedTest }) {
  const errors = test.issues.filter((i) => i.severity === 'error').length
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
      <div className={cn('overflow-hidden rounded-xl border', errors ? 'border-destructive/30' : 'border-warning/40')}>
        <div className={cn('flex items-center gap-2 px-5 py-3 text-[14px] font-semibold', errors ? 'bg-destructive/[0.07]' : 'bg-warning/10')}>
          {errors ? <CircleAlert className="size-4 text-destructive" /> : <AlertTriangle className="size-4 text-warning" />}
          {errors ? `This file has ${errors} ${errors === 1 ? 'problem' : 'problems'}` : 'Warnings'}
          <span className="ml-auto text-[12px] font-normal text-muted-foreground">Fix the file and it reloads automatically</span>
        </div>
        <ul className="selectable divide-y text-[13.5px]">
          {test.issues.map((iss, i) => (
            <li key={i} className="flex gap-3 px-5 py-2.5">
              <span className={cn('mt-0.5 size-2 shrink-0 translate-y-1 rounded-full', iss.severity === 'error' ? 'bg-destructive' : 'bg-warning')} />
              <span className="w-28 shrink-0 font-mono text-[12px] text-muted-foreground">
                {iss.questionId ? `${iss.questionId} · ` : ''}
                {iss.line ? `line ${iss.line}` : ''}
              </span>
              <span className="flex-1">
                <IssueText text={iss.message} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  )
}

/** Renders `code` spans in validation messages. */
function IssueText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1 py-px font-mono text-[12px]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}
