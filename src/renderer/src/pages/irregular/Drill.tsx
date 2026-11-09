import { ArrowLeft, Check, PartyPopper, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Progress } from '@/components/ui/progress'
import { useKeydown } from '@/hooks/useHotkey'
import { cn, pct, plural } from '@/lib/utils'
import { checkVerb, GROUP_INFO, gradeFor, requeue, type VerbCheck } from '@shared/irregular'
import type { IrregularVerb } from '@shared/types'

interface Result {
  check: VerbCheck | null // null: "I don't know"
  firstTry: boolean
}

/** One practice session: V1 and the translation are shown, the learner types V2 and V3. */
export function Drill({ queue: initial, title, onExit }: { queue: IrregularVerb[]; title: string; onExit: () => void }) {
  const [queue, setQueue] = useState(initial)
  const [index, setIndex] = useState(0)
  const [v2, setV2] = useState('')
  const [v3, setV3] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [missed, setMissed] = useState<Map<string, IrregularVerb>>(new Map())
  const [answered, setAnswered] = useState(0)
  const v2Ref = useRef<HTMLInputElement>(null)
  const v3Ref = useRef<HTMLInputElement>(null)
  const done = index >= queue.length
  const verb = queue[index]
  const seenBefore = verb ? seen.has(verb.id) : false
  const retry = seenBefore && !result

  useEffect(() => {
    if (!result) v2Ref.current?.focus()
  }, [index, result])

  const submit = (giveUp = false): void => {
    if (!verb || result) return
    const check = giveUp ? null : checkVerb(verb, { v2, v3 })
    const ok = Boolean(check?.all)
    const firstTry = ok && !seenBefore
    setResult({ check, firstTry })
    setAnswered((n) => n + 1)
    setSeen((s) => new Set(s).add(verb.id))
    void window.api.irregular.review(verb.id, gradeFor(ok))
    if (!ok) {
      setMissed((m) => new Map(m).set(verb.id, verb))
      setQueue((q) => requeue(q, index))
    }
  }

  const next = (): void => {
    setResult(null)
    setV2('')
    setV3('')
    setIndex((i) => i + 1)
  }

  useKeydown((e) => {
    if (e.key === 'Escape') onExit()
    else if (e.key === 'Enter' && result) {
      e.preventDefault()
      next()
    }
  })

  if (done) {
    const total = answered
    const right = total - [...missed.keys()].length
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
        <PartyPopper className="size-10 text-primary" />
        <h2 className="text-[22px] font-semibold tracking-tight">{missed.size ? 'Session finished' : 'Perfect session!'}</h2>
        <p className="text-[14px] text-muted-foreground">
          {plural(total, 'answer')}
          {total > 0 && <> · {pct(Math.max(0, right), seen.size || 1)}% verbs right the first time</>}
        </p>
        {missed.size > 0 && (
          <div className="w-full max-w-[460px] rounded-xl border p-4 text-left">
            <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">To look at again</div>
            {[...missed.values()].map((m) => (
              <div key={m.id} className="flex justify-between gap-3 py-1 text-[14px]">
                <b>{m.v1}</b>
                <span className="text-muted-foreground">
                  {m.v2} · {m.v3}
                </span>
              </div>
            ))}
          </div>
        )}
        <Button onClick={onExit}>Back to irregular verbs</Button>
      </div>
    )
  }

  const info = GROUP_INFO[verb.group]
  const field = (key: 'v2' | 'v3', value: string, set: (s: string) => void, ref: React.RefObject<HTMLInputElement | null>, label: string) => {
    const ok = result?.check?.[key]
    return (
      <div className="flex-1">
        <div className="mb-1 text-[12px] font-medium text-muted-foreground">{label}</div>
        <input
          ref={ref}
          value={value}
          disabled={Boolean(result)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || result) return
            e.preventDefault()
            e.stopPropagation()
            if (key === 'v2' && !v3) v3Ref.current?.focus()
            else submit()
          }}
          className={cn(
            'h-12 w-full rounded-xl border bg-background px-4 text-center text-[20px] font-medium outline-none transition-colors focus:border-ring/60',
            result && (ok ? 'border-emerald-500 bg-emerald-500/[0.07]' : 'border-destructive bg-destructive/[0.07]')
          )}
        />
        {result && !ok && <div className="mt-1.5 text-center text-[15px] font-semibold text-emerald-600 dark:text-emerald-400">{key === 'v2' ? verb.v2 : verb.v3}</div>}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="drag flex h-[64px] shrink-0 items-center gap-4 border-b px-8">
        <Button variant="ghost" size="sm" className="no-drag" onClick={onExit}>
          <ArrowLeft /> {title}
        </Button>
        <Progress value={pct(index, queue.length)} className="max-w-[320px]" />
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {index + 1} / {queue.length}
        </span>
        <span className="ml-auto text-[12px] text-muted-foreground">
          <Kbd>Esc</Kbd> to stop
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-8">
        <div className="w-full max-w-[560px] space-y-6">
          <div className="text-center">
            {retry && <div className="mb-2 text-[12px] font-medium text-amber-600 dark:text-amber-400">Once more</div>}
            <div className="text-[40px] font-semibold tracking-tight">{verb.v1}</div>
            <div className="mt-1 text-[15px] text-muted-foreground">{verb.uk}</div>
          </div>
          <div className="flex gap-4">
            {field('v2', v2, setV2, v2Ref, 'V2 · Past Simple')}
            {field('v3', v3, setV3, v3Ref, 'V3 · Past Participle')}
          </div>
          {result ? (
            <div className="space-y-3 text-center">
              <div className={cn('flex items-center justify-center gap-1.5 text-[14px] font-medium', result.check?.all ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                {result.check?.all ? <Check className="size-4" /> : <X className="size-4" />}
                {result.check?.all ? (result.firstTry ? 'Correct' : 'Correct — it will come again later') : 'Not quite — it will come back in a few cards'}
              </div>
              {!result.check?.all && (
                <p className="text-[12.5px] text-muted-foreground">
                  {info.scheme} · {info.tip}
                </p>
              )}
              <Button size="lg" onClick={next}>
                Next <Kbd>↵</Kbd>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Button size="lg" onClick={() => submit()} disabled={!v2.trim() && !v3.trim()}>
                Check <Kbd>↵</Kbd>
              </Button>
              <Button variant="ghost" onClick={() => submit(true)}>
                I don’t know
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
