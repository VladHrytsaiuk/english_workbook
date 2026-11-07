import { motion } from 'framer-motion'
import { Check, CircleAlert, Lightbulb, Sparkles, ThumbsUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ScoreRing } from '@/pages/run/Results'
import { CRITERIA, CRITERION_LABEL, learnerText, segmentText } from '@shared/writing'
import type { MistakeCategory, WritingEntry } from '@shared/types'

export const CATEGORY_LABEL: Record<MistakeCategory, string> = {
  grammar: 'Grammar',
  tense: 'Tense',
  article: 'Article',
  preposition: 'Preposition',
  'word order': 'Word order',
  vocabulary: 'Vocabulary',
  spelling: 'Spelling',
  punctuation: 'Punctuation',
  style: 'Style'
}

const barColor = (score: number): string => (score >= 4 ? 'bg-success' : score === 3 ? 'bg-primary' : score === 2 ? 'bg-warning' : 'bg-destructive')

/** Feedback on an essay or a conversation: scores, summary, the text with marked mistakes, corrections, improved version. */
export function EvaluationView({ entry }: { entry: WritingEntry }) {
  const ev = entry.evaluation
  const [active, setActive] = useState<number | null>(null)
  const labels = CRITERION_LABEL[entry.kind]
  const parts = useMemo(() => (ev && entry.kind === 'essay' ? segmentText(entry.text, ev.corrections) : []), [ev, entry])
  if (!ev) return null

  return (
    <div className="space-y-8">
      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-8">
        <div className="flex flex-col items-center gap-2">
          <ScoreRing value={ev.overall} />
          {ev.cefr && <Badge variant="default">Level ≈ {ev.cefr}</Badge>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Sparkles className="size-4 text-primary" /> Feedback from {ev.provider === 'claude' ? 'Claude' : 'Gemini'}
          </div>
          <p className="selectable mt-1.5 text-[15px] leading-relaxed" data-translate="other" data-source-title={entry.title}>
            {ev.summary}
          </p>
          <div className="mt-4 grid gap-2.5">
            {CRITERIA.map((k) => (
              <div key={k} className="grid grid-cols-[170px_1fr_34px] items-center gap-3" title={labels[k].hint}>
                <span className="text-[13px]">{labels[k].name}</span>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <motion.div className={cn('h-full rounded-full', barColor(ev.scores[k]))} initial={{ width: 0 }} animate={{ width: `${(ev.scores[k] / 5) * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                </div>
                <span className="text-right text-[12.5px] tabular-nums text-muted-foreground">{ev.scores[k]}/5</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground">The score is feedback from an AI, not an official exam result: use it to see how you are progressing.</p>
        </div>
      </motion.div>

      {(ev.strengths.length > 0 || ev.improvements.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              <ThumbsUp className="size-4 text-success" /> What went well
            </h3>
            <ul className="selectable space-y-1.5 text-[13.5px] leading-snug" data-translate="other" data-source-title={entry.title}>
              {ev.strengths.map((s) => (
                <li key={s} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
              <Lightbulb className="size-4 text-warning" /> Work on next
            </h3>
            <ul className="selectable space-y-1.5 text-[13.5px] leading-snug" data-translate="other" data-source-title={entry.title}>
              {ev.improvements.map((s) => (
                <li key={s} className="flex gap-2">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" /> {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {ev.targetWords.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Your target words</h3>
          <div className="flex flex-wrap gap-2">
            {ev.targetWords.map((w) => (
              <span
                key={w.word}
                title={w.note}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px]',
                  w.used && w.correct ? 'border-success/40 bg-success/10' : w.used ? 'border-warning/50 bg-warning/10' : 'text-muted-foreground'
                )}
              >
                {w.used && w.correct ? <Check className="size-3.5 text-success" /> : w.used ? <CircleAlert className="size-3.5 text-warning" /> : <X className="size-3.5" />}
                {w.word}
                {w.note && <span className="text-[11.5px] text-muted-foreground">· {w.note}</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* The learner's words with the mistakes marked */}
      <section>
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{entry.kind === 'essay' ? 'Your text' : 'Your messages'}</h3>
        {entry.kind === 'essay' ? (
          <Card className="selectable whitespace-pre-wrap p-5 text-[15px] leading-[1.8]" data-translate="other" data-source-title={entry.title}>
            {parts.map((p, i) =>
              p.correction === undefined ? (
                <span key={i}>{p.text}</span>
              ) : (
                <button
                  key={i}
                  onClick={() => setActive(active === p.correction ? null : (p.correction ?? null))}
                  className={cn('rounded-sm bg-warning/20 px-0.5 underline decoration-warning decoration-wavy underline-offset-4', active === p.correction && 'bg-warning/40')}
                >
                  {p.text}
                </button>
              )
            )}
          </Card>
        ) : (
          <Card className="selectable divide-y" data-translate="other" data-source-title={entry.title}>
            {entry.messages.map((m, i) => (
              <div key={i} className={cn('px-5 py-3 text-[14px] leading-relaxed', m.role === 'assistant' && 'bg-muted/40')}>
                <div className="mb-0.5 text-[11.5px] font-medium text-muted-foreground">{m.role === 'user' ? 'You' : (entry.aiRole ?? 'Partner')}</div>
                {m.content}
              </div>
            ))}
          </Card>
        )}
      </section>

      {ev.corrections.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Corrections ({ev.corrections.length})</h3>
          <Card className="divide-y">
            {ev.corrections.map((c, i) => (
              <div key={i} onClick={() => setActive(active === i ? null : i)} className={cn('cursor-pointer px-5 py-3.5 transition-colors', active === i ? 'bg-warning/10' : 'hover:bg-muted/40')}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14.5px]">
                  <span className="text-destructive line-through decoration-destructive/50">{c.original}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-success">{c.corrected}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {CATEGORY_LABEL[c.category]}
                  </Badge>
                </div>
                {c.explanation && (
                  <p className="selectable mt-1 text-[13px] leading-snug text-muted-foreground" data-translate="other" data-source-title={entry.title}>
                    {c.explanation}
                  </p>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}
      {ev.corrections.length === 0 && (
        <Card className="flex items-center gap-3 px-5 py-4 text-[14px]">
          <Check className="size-4 text-success" /> No clear mistakes were found.
        </Card>
      )}

      {ev.improved && ev.improved.trim() !== learnerText(entry).trim() && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Improved version</h3>
          <Card className="selectable p-5" data-translate="other" data-source-title={entry.title}>
            <Markdown className="text-[15px] leading-[1.8] [&_p]:my-2">{ev.improved}</Markdown>
          </Card>
        </section>
      )}
    </div>
  )
}
