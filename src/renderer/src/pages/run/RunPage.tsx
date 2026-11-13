import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, BookOpenText, Check, CircleHelp, Lightbulb, ThumbsUp, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InlineMarkdown, Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Progress } from '@/components/ui/progress'
import { useKeydown } from '@/hooks/useHotkey'
import { type Route, type RunSession, useApp } from '@/lib/store'
import { cn, isTyping, uid } from '@/lib/utils'
import { checkAnswer, formatCorrectAnswer, formatUserAnswer } from '@shared/answer'
import { arrangeItems } from '@shared/arrange'
import type { Attempt, CheckResult, QuestionResult, ReadingPassage, TestItem, UserAnswer } from '@shared/types'
import { EnterHint, QuestionBody, QuestionPrompt, TYPE_LABEL, isReady } from './questions'
import { Results } from './Results'

interface Graded extends CheckResult {
  overridden?: boolean
}

const TYPED = new Set(['gap', 'transform', 'error'])

function buildAttempt(session: RunSession, items: TestItem[], startedAt: string, answers: Record<string, UserAnswer>, graded: Record<string, Graded>, completed: boolean): Attempt {
  const results: QuestionResult[] = items
    .filter((i) => graded[i.key])
    .map((i) => ({
      key: i.key,
      questionId: i.id,
      type: i.type,
      topics: i.topics,
      correct: graded[i.key].correct,
      overridden: graded[i.key].overridden || undefined,
      word: i.word,
      userAnswer: formatUserAnswer(i, answers[i.key]),
      correctAnswer: formatCorrectAnswer(i)
    }))
  return {
    id: uid(),
    testId: session.testId,
    testTitle: session.title,
    mode: session.mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    completed,
    total: completed ? items.length : results.length,
    correct: results.filter((r) => r.correct).length,
    results
  }
}

export function RunPage({ session, back }: { session: RunSession; back: Route }) {
  const { navigate, settings, bumpData, toast } = useApp()
  // Question and option order is fixed once per session (going back to a question shows the same order).
  const items = useMemo(
    () => arrangeItems(session.items, { questions: settings?.shuffleQuestions ?? true, answers: settings?.shuffleAnswers ?? true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.id]
  )
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({})
  const [graded, setGraded] = useState<Record<string, Graded>>({})
  const [hintShown, setHintShown] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState<Attempt | null>(null)
  const startedAt = useRef(new Date().toISOString())
  const saved = useRef(false)
  const latest = useRef({ answers, graded })
  latest.current = { answers, graded }

  const item = items[idx]
  const result = item ? graded[item.key] : undefined
  const locked = Boolean(result)
  const answeredCount = Object.keys(graded).length

  const save = useCallback(
    async (completed: boolean): Promise<Attempt | null> => {
      if (saved.current) return null
      const { answers: a, graded: g } = latest.current
      if (!Object.keys(g).length) return null
      saved.current = true
      const attempt = buildAttempt(session, items, startedAt.current, a, g, completed)
      await window.api.progress.saveAttempt(attempt, items)
      bumpData()
      return attempt
    },
    [session, items, bumpData]
  )

  // Leaving mid-test (sidebar, ⌘1…) still records what was answered.
  // Only on a real unmount: `save` changes identity with the app context, and a cleanup that ran then would
  // store a half-finished attempt and block the final save.
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    return () => {
      if (!saved.current && Object.keys(latest.current.graded).length) void saveRef.current(false)
    }
  }, [])

  const exit = (): void => {
    if (!saved.current && answeredCount > 0) {
      void save(false)
      toast(`Progress saved: ${answeredCount} of ${items.length} answered.`)
    }
    navigate(back, { end: true })
  }

  const check = (giveUp = false): void => {
    if (!item || locked) return
    const value = answers[item.key]
    if (!giveUp && !isReady(item, value)) return
    const r = giveUp ? { correct: false } : checkAnswer(item, value as UserAnswer, { forgiveTypos: settings?.forgiveTypos ?? true })
    setGraded((g) => ({ ...g, [item.key]: r }))
  }

  const finish = async (): Promise<void> => {
    const attempt = await save(true)
    setFinished(attempt ?? buildAttempt(session, items, startedAt.current, answers, graded, true))
  }

  const next = (): void => {
    if (!locked) return
    if (idx < items.length - 1) setIdx(idx + 1)
    else void finish()
  }

  const override = (): void => {
    if (!item) return
    setGraded((g) => ({ ...g, [item.key]: { ...g[item.key], correct: true, overridden: true } }))
  }

  useKeydown((e) => {
    if (finished) return
    if (e.key === 'Escape') {
      e.preventDefault()
      exit()
      return
    }
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      // Enter always means check / continue (buttons can still be pressed with Space).
      e.preventDefault()
      if (locked) next()
      else check()
      return
    }
    const textFocused = isTyping(e) && !locked
    if (e.key === 'ArrowRight' && !textFocused && locked) {
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft' && !textFocused && idx > 0) {
      e.preventDefault()
      setIdx(idx - 1)
    } else if (e.key.toLowerCase() === 'h' && !isTyping(e) && !e.metaKey && !e.ctrlKey && item?.hint) {
      setHintShown((h) => ({ ...h, [item.key]: true }))
    }
  })

  if (finished) {
    return <Results session={session} attempt={finished} onBack={() => navigate(back, { end: true })} />
  }

  if (!item) return null

  const progress = (answeredCount / items.length) * 100
  const passage = item.reading

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="drag flex h-[64px] shrink-0 items-center gap-4 border-b px-6">
        <Button variant="ghost" size="sm" className="no-drag -ml-2 text-muted-foreground" onClick={exit}>
          <ArrowLeft /> Exit <Kbd className="ml-1">Esc</Kbd>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="truncate font-medium">{session.title}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {idx + 1} / {items.length}
            </span>
          </div>
          <Progress value={progress} className="mt-1.5" />
        </div>
      </header>

      {/* Body */}
      <div className={cn('flex min-h-0 flex-1', passage ? 'flex-row' : 'flex-col')}>
        {passage && <PassagePane passage={passage} sessionTitle={session.title} />}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn('mx-auto w-full px-8 pb-16 pt-10', passage ? 'max-w-[620px]' : 'max-w-[720px]')}
            data-translate="test"
            data-source-title={session.title}
            data-source-ref={item.key}
          >
            {/* Enter-only animation: the next question is interactive immediately (fast keyboard use). */}
            <motion.div key={item.key} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{TYPE_LABEL[item.type]}</Badge>
                  {/* The topic can give the answer away, so it is shown once the question is answered. */}
                  {(locked || settings?.showTopics) && item.topics.slice(0, 2).map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                  <span className="ml-auto text-[11.5px] text-muted-foreground">{item.id}</span>
                </div>

                <div className="space-y-6">
                  <QuestionPrompt q={item} />
                  <QuestionBody
                    q={item}
                    itemKey={item.key}
                    value={answers[item.key]}
                    onChange={(v) => !locked && setAnswers((a) => ({ ...a, [item.key]: v }))}
                    locked={locked}
                    result={result}
                  />
                </div>

                {!locked && item.hint && (
                  <div className="mt-5">
                    {hintShown[item.key] ? (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[13.5px]">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
                        <InlineMarkdown>{item.hint}</InlineMarkdown>
                      </motion.div>
                    ) : (
                      <button className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setHintShown((h) => ({ ...h, [item.key]: true }))}>
                        <Lightbulb className="size-3.5" /> Show hint <Kbd>H</Kbd>
                      </button>
                    )}
                  </div>
                )}

                <AnimatePresence>{result && <Feedback item={item} result={result} answer={answers[item.key]} onOverride={override} />}</AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex h-[64px] shrink-0 items-center justify-between gap-3 border-t px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)} className="text-muted-foreground">
            <ArrowLeft /> Previous
          </Button>
          {!locked && (
            <Button variant="ghost" size="sm" onClick={() => check(true)} className="text-muted-foreground">
              <CircleHelp /> I don't know
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-[12px] text-muted-foreground lg:inline">{hintText(item, locked)}</span>
          {locked ? (
            <Button onClick={next} autoFocus={false}>
              {idx < items.length - 1 ? 'Continue' : 'See results'} <ArrowRight />
            </Button>
          ) : (
            <Button onClick={() => check()} disabled={!isReady(item, answers[item.key])}>
              Check
            </Button>
          )}
          <EnterHint label={locked ? 'next' : 'check'} />
        </div>
      </footer>
    </div>
  )
}

function hintText(item: TestItem, locked: boolean): string {
  if (locked) return '← → to move between questions'
  switch (item.type) {
    case 'choice':
      return 'Press 1–9 to choose'
    case 'tf':
      return item.notGiven ? '1 / T · 2 / F · 3 / N' : '1 / T · 2 / F'
    case 'order':
      return '1–9 to pick · Backspace to undo'
    case 'match':
      return '↑↓ select row · 1–9 pick match'
    default:
      return 'Type your answer'
  }
}

function PassagePane({ passage, sessionTitle }: { passage: ReadingPassage; sessionTitle: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the scroll position while moving between sub-questions of the same passage.
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [passage.id])
  return (
    <div ref={ref} className="min-h-0 w-[46%] max-w-[640px] shrink-0 overflow-y-auto border-r bg-muted/25">
      <div className="px-10 pb-16 pt-9" data-translate="test" data-source-title={`${sessionTitle} — ${passage.title}`} data-source-ref={passage.id}>
        <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
          <BookOpenText className="size-3.5" /> Reading · {passage.id}
        </div>
        <h2 className="mb-5 text-[21px] font-semibold tracking-tight">{passage.title}</h2>
        <div className="selectable">
          <Markdown className="text-[16px] leading-[1.8]">{passage.passage}</Markdown>
        </div>
      </div>
    </div>
  )
}

function Feedback({ item, result, answer, onOverride }: { item: TestItem; result: Graded; answer: UserAnswer | undefined; onOverride(): void }) {
  const ok = result.correct
  const typo = ok && Boolean(result.typo)
  const showCorrect = (!ok && item.type !== 'match') || typo
  const canOverride = !ok && TYPED.has(item.type) && typeof answer === 'string' && answer.trim().length > 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('mt-7 overflow-hidden rounded-2xl border', typo ? 'border-amber-500/40 bg-amber-500/[0.07]' : ok ? 'border-success/30 bg-success/[0.06]' : 'border-destructive/30 bg-destructive/[0.05]')}
    >
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <span className={cn('flex size-6 items-center justify-center rounded-full', typo ? 'bg-amber-500 text-white' : ok ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
          {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="text-[15px] font-semibold">{typo ? 'Correct — mind the spelling' : ok ? (result.overridden ? 'Counted as correct' : 'Correct!') : 'Not quite'}</span>
        {result.partial && !ok && (
          <span className="text-[13px] text-muted-foreground">
            {result.partial.right} of {result.partial.total} pairs right
          </span>
        )}
        {canOverride && (
          <Button variant="outline" size="sm" className="ml-auto h-7" onClick={onOverride}>
            <ThumbsUp className="!size-3.5" /> Count as correct
          </Button>
        )}
      </div>
      <div className="selectable space-y-3 px-5 pb-5 pt-3">
        {showCorrect && (
          <div className="text-[14px]">
            <span className="text-muted-foreground">{typo ? 'Correct spelling: ' : 'Correct answer: '}</span>
            <span className="font-semibold text-success">
              {'answers' in item ? item.answers.join('  ·  ') : formatCorrectAnswer(item)}
            </span>
            {TYPED.has(item.type) && typeof answer === 'string' && answer.trim() && (
              <div className="mt-1">
                <span className="text-muted-foreground">Your answer: </span>
                <span className={typo ? 'line-through decoration-amber-500/70' : 'line-through decoration-destructive/60'}>{answer}</span>
              </div>
            )}
          </div>
        )}
        {item.explain ? (
          <Markdown className="text-[14.5px] [&_p]:my-1.5">{item.explain}</Markdown>
        ) : (
          <p className="text-[13px] italic text-muted-foreground">No explanation in the file for this question.</p>
        )}
      </div>
    </motion.div>
  )
}
