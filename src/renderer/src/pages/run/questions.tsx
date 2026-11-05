import { motion } from 'framer-motion'
import { Check, CornerDownLeft, Delete, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { InlineMarkdown } from '@/components/Markdown'
import { Kbd } from '@/components/ui/kbd'
import { useKeydown } from '@/hooks/useHotkey'
import { cn, isTyping, shuffleDifferent } from '@/lib/utils'
import type {
  CheckResult,
  ChoiceQuestion,
  MatchQuestion,
  OrderQuestion,
  SimpleQuestion,
  TextQuestion,
  TfQuestion,
  TfValue,
  UserAnswer
} from '@shared/types'

export interface QProps<Q extends SimpleQuestion> {
  q: Q
  /** Stable per-item key (used to keep shuffles stable). */
  itemKey: string
  value: UserAnswer | undefined
  onChange(v: UserAnswer): void
  /** True once the answer has been checked. */
  locked: boolean
  result?: CheckResult
}

export const TYPE_LABEL: Record<SimpleQuestion['type'], string> = {
  choice: 'Multiple choice',
  gap: 'Fill the gap',
  transform: 'Rewrite',
  error: 'Find the mistake',
  order: 'Word order',
  match: 'Match pairs',
  tf: 'True / False'
}

export function isReady(q: SimpleQuestion, v: UserAnswer | undefined): boolean {
  if (v === undefined) return false
  switch (q.type) {
    case 'order':
      return Array.isArray(v) && v.length === q.chunks.length
    case 'match':
      return Array.isArray(v) && v.length === q.pairs.length && v.every((x) => x >= 0)
    default:
      return typeof v === 'string' && v.trim().length > 0
  }
}

/** Number key 1–9 pressed (and not typing in a field)? Returns 0-based index or -1. */
function digitIndex(e: KeyboardEvent): number {
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return -1
  const n = Number(e.key)
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n - 1 : -1
}

// ───────────────────────── choice ─────────────────────────

export function ChoiceView({ q, value, onChange, locked }: QProps<ChoiceQuestion>) {
  // Options arrive already in session order (see arrangeItems).
  const options = q.options
  useKeydown((e) => {
    const i = digitIndex(e)
    if (i >= 0 && i < options.length) {
      e.preventDefault()
      onChange(options[i])
    }
  }, !locked)

  return (
    <div className="grid gap-2">
      {options.map((opt, i) => {
        const selected = value === opt
        const isAnswer = opt === q.answer
        const state = !locked ? (selected ? 'selected' : 'idle') : isAnswer ? 'correct' : selected ? 'wrong' : 'dim'
        return (
          <OptionButton key={opt} index={i} state={state} disabled={locked} onClick={() => onChange(opt)}>
            <InlineMarkdown>{opt}</InlineMarkdown>
          </OptionButton>
        )
      })}
    </div>
  )
}

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim'

function OptionButton({
  index,
  state,
  children,
  onClick,
  disabled,
  hotkey
}: {
  index: number
  state: OptionState
  children: React.ReactNode
  onClick(): void
  disabled?: boolean
  hotkey?: string
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.99 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] transition-colors',
        state === 'idle' && 'bg-card hover:border-foreground/20 hover:bg-accent/40',
        state === 'selected' && 'border-primary bg-primary/[0.06] ring-1 ring-primary',
        state === 'correct' && 'border-success/60 bg-success/10',
        state === 'wrong' && 'border-destructive/60 bg-destructive/10',
        state === 'dim' && 'opacity-55'
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md border text-[12px] font-medium text-muted-foreground',
          state === 'selected' && 'border-primary bg-primary text-primary-foreground',
          state === 'correct' && 'border-success bg-success text-success-foreground',
          state === 'wrong' && 'border-destructive bg-destructive text-destructive-foreground'
        )}
      >
        {state === 'correct' ? <Check className="size-3.5" /> : state === 'wrong' ? <X className="size-3.5" /> : (hotkey ?? index + 1)}
      </span>
      <span className="flex-1">{children}</span>
    </motion.button>
  )
}

// ───────────────────────── true / false ─────────────────────────

export function TfView({ q, value, onChange, locked }: QProps<TfQuestion>) {
  const opts: { v: TfValue; label: string; key: string }[] = [
    { v: 'true', label: 'True', key: 't' },
    { v: 'false', label: 'False', key: 'f' },
    ...(q.notGiven ? [{ v: 'not given' as TfValue, label: 'Not Given', key: 'n' }] : [])
  ]
  useKeydown((e) => {
    const i = digitIndex(e)
    const byLetter = !isTyping(e) && !e.metaKey && !e.ctrlKey ? opts.findIndex((o) => o.key === e.key.toLowerCase()) : -1
    const k = i >= 0 && i < opts.length ? i : byLetter
    if (k >= 0) {
      e.preventDefault()
      onChange(opts[k].v)
    }
  }, !locked)

  return (
    <div className={cn('grid gap-2', opts.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {opts.map((o, i) => {
        const selected = value === o.v
        const isAnswer = o.v === q.answer
        const state: OptionState = !locked ? (selected ? 'selected' : 'idle') : isAnswer ? 'correct' : selected ? 'wrong' : 'dim'
        return (
          <OptionButton key={o.v} index={i} state={state} disabled={locked} onClick={() => onChange(o.v)}>
            <span className="font-medium">{o.label}</span>
          </OptionButton>
        )
      })}
    </div>
  )
}

// ───────────────────────── typed: gap / transform / error ─────────────────────────

function useAutofocus(locked: boolean, itemKey: string): React.RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!locked) {
      const t = setTimeout(() => ref.current?.focus(), 60)
      return () => clearTimeout(t)
    }
    return undefined
  }, [locked, itemKey])
  return ref
}

const textState = (locked: boolean, result?: CheckResult): string =>
  !locked
    ? 'border-input focus:border-primary focus:ring-2 focus:ring-primary/20'
    : result?.correct
      ? 'border-success/70 bg-success/10 text-foreground'
      : 'border-destructive/70 bg-destructive/10 text-foreground'

export function GapView({ q, itemKey, value, onChange, locked, result }: QProps<TextQuestion>) {
  const ref = useAutofocus(locked, itemKey)
  const v = typeof value === 'string' ? value : ''
  const parts = q.prompt.split(/_{2,}/)
  const inline = parts.length === 2

  const input = (
    <input
      ref={ref}
      value={v}
      readOnly={locked}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoComplete="off"
      placeholder={inline ? '' : 'Type the missing word(s)'}
      style={inline ? { width: `${Math.max(9, v.length + 2)}ch` } : undefined}
      className={cn(
        'rounded-lg border bg-background px-2.5 font-medium outline-none transition-[width,colors] duration-100',
        inline ? 'mx-1 inline-block h-9 align-middle text-[17px]' : 'h-11 w-full text-[16px]',
        textState(locked, result)
      )}
    />
  )

  if (inline) {
    return (
      <div className="selectable text-[19px] leading-[2.4] tracking-[-0.005em]">
        <InlineMarkdown>{parts[0]}</InlineMarkdown>
        {input}
        <InlineMarkdown>{parts[1]}</InlineMarkdown>
      </div>
    )
  }
  return <div>{input}</div>
}

export function TextView({ q, itemKey, value, onChange, locked, result }: QProps<TextQuestion>) {
  const ref = useAutofocus(locked, itemKey)
  // For "find the mistake", start from the original sentence so the learner only edits it.
  useEffect(() => {
    if (q.type === 'error' && value === undefined) onChange(q.prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey])
  return (
    <input
      ref={ref}
      value={typeof value === 'string' ? value : ''}
      readOnly={locked}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoComplete="off"
      placeholder={q.type === 'transform' ? 'Write the new sentence' : 'Correct the sentence'}
      className={cn('h-12 w-full rounded-xl border bg-background px-4 text-[16px] outline-none transition-colors', textState(locked, result))}
    />
  )
}

// ───────────────────────── order ─────────────────────────

export function OrderView({ q, itemKey, value, onChange, locked, result }: QProps<OrderQuestion>) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => shuffleDifferent(q.chunks.map((_, i) => i)), [itemKey])
  const picked = Array.isArray(value) ? value : []
  const remaining = pool.filter((i) => !picked.includes(i))

  const pick = (i: number): void => onChange([...picked, i])
  const unpick = (pos: number): void => onChange(picked.filter((_, j) => j !== pos))

  useKeydown((e) => {
    const d = digitIndex(e)
    if (d >= 0 && d < remaining.length) {
      e.preventDefault()
      pick(remaining[d])
    } else if (e.key === 'Backspace' && !isTyping(e) && picked.length) {
      e.preventDefault()
      unpick(picked.length - 1)
    }
  }, !locked)

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'flex min-h-[64px] flex-wrap items-center gap-2 rounded-xl border-2 border-dashed px-3 py-3 transition-colors',
          !locked && 'bg-muted/30',
          locked && result?.correct && 'border-solid border-success/60 bg-success/10',
          locked && !result?.correct && 'border-solid border-destructive/60 bg-destructive/10'
        )}
      >
        {picked.length === 0 && <span className="px-1 text-[14px] text-muted-foreground">Click the chunks below in the right order…</span>}
        {picked.map((ci, pos) => (
          <motion.button
            layoutId={`${itemKey}-chunk-${ci}`}
            key={ci}
            disabled={locked}
            onClick={() => unpick(pos)}
            className="rounded-lg border bg-card px-3 py-1.5 text-[15px] font-medium shadow-sm transition-colors hover:border-destructive/40"
          >
            {q.chunks[ci]}
          </motion.button>
        ))}
        {!locked && picked.length > 0 && (
          <button onClick={() => unpick(picked.length - 1)} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Remove last (Backspace)">
            <Delete className="size-4" />
          </button>
        )}
      </div>
      {!locked && (
        <div className="flex flex-wrap gap-2">
          {remaining.map((ci, i) => (
            <motion.button
              layoutId={`${itemKey}-chunk-${ci}`}
              key={ci}
              onClick={() => pick(ci)}
              className="group flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-[15px] shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/[0.04]"
            >
              {i < 9 && <span className="text-[11px] font-medium text-muted-foreground">{i + 1}</span>}
              {q.chunks[ci]}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── match ─────────────────────────

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function MatchView({ q, itemKey, value, onChange, locked }: QProps<MatchQuestion>) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rightOrder = useMemo(() => shuffleDifferent(q.pairs.map((_, i) => i)), [itemKey])
  const assign = Array.isArray(value) && value.length === q.pairs.length ? value : q.pairs.map(() => -1)
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
  }, [itemKey])

  const choose = (rightIdx: number): void => {
    const next = assign.map((a) => (a === rightIdx ? -1 : a))
    next[active] = rightIdx
    onChange(next)
    const after = next.findIndex((a, i) => a < 0 && i > active)
    const anyFree = next.findIndex((a) => a < 0)
    setActive(after >= 0 ? after : anyFree >= 0 ? anyFree : active)
  }

  useKeydown((e) => {
    const d = digitIndex(e)
    if (d >= 0 && d < rightOrder.length) {
      e.preventDefault()
      choose(rightOrder[d])
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isTyping(e)) {
      e.preventDefault()
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + q.pairs.length) % q.pairs.length)
    } else if (e.key === 'Backspace' && !isTyping(e)) {
      e.preventDefault()
      const next = [...assign]
      next[active] = -1
      onChange(next)
    }
  }, !locked)

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-6">
      <div className="space-y-2">
        {q.pairs.map((p, i) => {
          const chosen = assign[i]
          const ok = locked && chosen >= 0 && q.pairs[chosen].right === p.right
          return (
            <button
              key={p.left}
              disabled={locked}
              onClick={() => setActive(i)}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-xl border bg-card px-3.5 py-2.5 text-left transition-colors',
                !locked && active === i && 'border-primary ring-1 ring-primary',
                locked && ok && 'border-success/60 bg-success/10',
                locked && !ok && 'border-destructive/60 bg-destructive/10'
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">{LETTERS[i]}</span>
                <span className="flex-1 text-[14.5px] font-medium">{p.left}</span>
                {locked && (ok ? <Check className="size-4 text-success" /> : <X className="size-4 text-destructive" />)}
              </div>
              <div className={cn('ml-[30px] text-[13.5px]', chosen >= 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {chosen >= 0 ? <span className={cn(locked && !ok && 'line-through opacity-70')}>→ {q.pairs[chosen].right}</span> : '→ …'}
                {locked && !ok && <div className="font-medium text-success">→ {p.right}</div>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="space-y-2">
        {rightOrder.map((ri, i) => {
          const usedBy = assign.indexOf(ri)
          return (
            <button
              key={ri}
              disabled={locked}
              onClick={() => choose(ri)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 text-left text-[14px] transition-colors',
                !locked && 'hover:border-primary/50 hover:bg-primary/[0.04]',
                usedBy >= 0 && 'bg-muted/50 text-muted-foreground'
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded border text-[11px] font-medium text-muted-foreground">{i + 1}</span>
              <span className="flex-1">{q.pairs[ri].right}</span>
              {usedBy >= 0 && <span className="rounded bg-primary/12 px-1.5 text-[11px] font-semibold text-primary">{LETTERS[usedBy]}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── dispatcher ─────────────────────────

export function QuestionBody(props: QProps<SimpleQuestion>) {
  const { q } = props
  switch (q.type) {
    case 'choice':
      return <ChoiceView {...props} q={q} />
    case 'tf':
      return <TfView {...props} q={q} />
    case 'gap':
      return <GapView {...props} q={q} />
    case 'transform':
    case 'error':
      return <TextView {...props} q={q} />
    case 'order':
      return <OrderView {...props} q={q} />
    case 'match':
      return <MatchView {...props} q={q} />
  }
}

/** Instruction line + prompt shown above the answer area. */
export function QuestionPrompt({ q }: { q: SimpleQuestion }) {
  if (q.type === 'gap' && q.prompt.split(/_{2,}/).length === 2) return null // rendered inline by GapView
  if (q.type === 'error')
    return (
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-muted-foreground">Find and correct the mistake:</p>
        <p className="selectable text-[19px] leading-relaxed">
          <InlineMarkdown>{q.prompt}</InlineMarkdown>
        </p>
      </div>
    )
  return (
    <p className="selectable text-[19px] leading-relaxed">
      <InlineMarkdown>{q.prompt}</InlineMarkdown>
    </p>
  )
}

export function EnterHint({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <Kbd>
        <CornerDownLeft className="size-3" />
      </Kbd>
      {label}
    </span>
  )
}
