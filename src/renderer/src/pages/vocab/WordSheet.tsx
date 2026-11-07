import { motion } from 'framer-motion'
import { BookOpen, ListChecks, Pause, Play, RotateCcw, Sparkles, Trash2, Volume2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDate } from '@/lib/utils'
import { speak, STATUS_STYLE } from '@/lib/vocab'
import { formatInterval, statusOf } from '@shared/srs'
import type { Deck, VocabEntry } from '@shared/types'

const NO_DECK = '__none__'

/** Text field that saves when it loses focus (or on ⌘↵ for multi-line). */
function Field({
  label,
  value,
  onSave,
  multiline,
  placeholder,
  className
}: {
  label?: string
  value: string
  onSave(v: string): void
  multiline?: boolean
  placeholder?: string
  className?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = (): void => {
    if (v.trim() !== value.trim()) onSave(v.trim())
  }
  const common = {
    value: v,
    placeholder,
    onBlur: commit,
    spellCheck: false,
    className: cn(
      'w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-[13.5px] outline-none transition-colors hover:border-input focus:border-ring/60 focus:bg-background',
      className
    )
  }
  return (
    <label className="block">
      {label && <span className="mb-0.5 block px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>}
      {multiline ? (
        <textarea
          {...common}
          rows={Math.max(2, v.split('\n').length)}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && (e.currentTarget as HTMLTextAreaElement).blur()}
          className={cn(common.className, 'resize-none leading-relaxed')}
        />
      ) : (
        <input {...common} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
      )}
    </label>
  )
}

export function WordSheet({
  entry,
  decks,
  onClose,
  onChange,
  onDelete,
  onReview,
  onEnrich,
  enriching
}: {
  entry: VocabEntry
  decks: Deck[]
  onClose(): void
  onChange(patch: Partial<VocabEntry>): void
  onDelete(): void
  onReview(): void
  onEnrich(): void
  enriching: boolean
}) {
  const [tagDraft, setTagDraft] = useState('')
  const status = entry.suspended ? 'suspended' : statusOf(entry)
  const st = STATUS_STYLE[status]
  const now = new Date()
  const due = new Date(entry.srs.due)

  const addTag = (): void => {
    const t = tagDraft.trim().toLowerCase().replace(/^#/, '')
    if (t && !entry.tags.includes(t)) onChange({ tags: [...entry.tags, t] })
    setTagDraft('')
  }

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute inset-y-0 right-0 z-30 flex w-[440px] flex-col border-l bg-background shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.18)]"
      data-no-translate
    >
      <div className="flex h-[64px] shrink-0 items-center gap-2 border-b px-4">
        <span className={cn('rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', st.className)}>{st.label}</span>
        {entry.srs.state !== 0 && !entry.suspended && (
          <span className="text-[12px] text-muted-foreground">{due <= now ? 'due now' : `next in ${formatInterval(now, due)}`}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={onReview} disabled={entry.suspended}>
            <Play className="!size-3.5" /> Practise
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-10 pt-4">
        <div>
          <div className="flex items-start gap-1">
            <Field value={entry.text} onSave={(text) => text && onChange({ text })} className="text-[22px] font-semibold tracking-tight" />
            <Button size="icon-sm" variant="ghost" className="mt-1.5 shrink-0" title="Listen" onClick={() => speak(entry.text)}>
              <Volume2 />
            </Button>
          </div>
          <div className="grid grid-cols-[1.3fr_1fr_0.6fr] gap-1">
            <Field value={entry.ipa ?? ''} placeholder="/IPA/" onSave={(ipa) => onChange({ ipa: ipa || undefined })} className="font-mono text-[12.5px] text-muted-foreground" />
            <Field value={entry.pos ?? ''} placeholder="part of speech" onSave={(pos) => onChange({ pos: pos || undefined })} className="text-[12.5px] italic text-muted-foreground" />
            <Field value={entry.level ?? ''} placeholder="level" onSave={(level) => onChange({ level: level.toUpperCase() || undefined })} className="text-[12.5px] text-muted-foreground" />
          </div>
        </div>

        <Field label="Translation" value={entry.translation} onSave={(translation) => onChange({ translation })} className="text-[15px]" />

        <div className="grid grid-cols-2 gap-2 px-2">
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Deck</span>
            <Select value={entry.deckId ?? NO_DECK} onValueChange={(v) => onChange({ deckId: v === NO_DECK ? undefined : v })}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DECK}>No deck</SelectItem>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="mr-2 inline-block size-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Topic</span>
            <input
              defaultValue={entry.topic ?? ''}
              key={entry.topic ?? ''}
              placeholder="e.g. Work"
              onBlur={(e) => e.target.value.trim() !== (entry.topic ?? '') && onChange({ topic: e.target.value.trim() || undefined })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none focus:border-ring/60"
            />
          </div>
        </div>

        <div className="px-2">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tags</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[12px]">
                #{t}
                <button onClick={() => onChange({ tags: entry.tags.filter((x) => x !== t) })} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())}
              onBlur={addTag}
              placeholder="+ tag"
              className="h-6 w-20 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {entry.context && (
          <div className="px-2">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Where you saw it</span>
            <p className="selectable border-l-2 border-primary/40 pl-3 text-[13.5px] italic leading-relaxed text-muted-foreground">{entry.context}</p>
            <p className="mt-1 flex items-center gap-1.5 pl-3 text-[11.5px] text-muted-foreground">
              {entry.source.kind === 'note' ? <BookOpen className="size-3" /> : entry.source.kind === 'test' ? <ListChecks className="size-3" /> : null}
              {entry.source.title || 'Added manually'} · {formatDate(entry.createdAt)}
            </p>
          </div>
        )}

        <Field
          label="Examples (one per line)"
          multiline
          value={(entry.examples ?? []).join('\n')}
          placeholder="Add example sentences…"
          onSave={(v) => onChange({ examples: v ? v.split('\n').map((x) => x.trim()).filter(Boolean) : undefined })}
        />

        <Field label="My note" multiline value={entry.note ?? ''} placeholder="Mnemonic, collocations, anything…" onSave={(note) => onChange({ note: note || undefined })} />

        {entry.explanation && (
          <div className="px-2">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Grammar note</span>
            <div className="selectable rounded-lg bg-muted/50 px-3 py-2">
              <Markdown className="text-[13px] [&_p]:my-1">{entry.explanation}</Markdown>
            </div>
          </div>
        )}

        <Button variant="outline" className="mx-2 w-[calc(100%-1rem)]" disabled={enriching} onClick={onEnrich}>
          <Sparkles className="text-primary" /> {enriching ? 'Asking AI…' : entry.pos || entry.examples?.length ? 'Refresh details with AI' : 'Fill details with AI'}
        </Button>

        <div className="mx-2 rounded-xl border p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Memory (FSRS)</div>
          <dl className="grid grid-cols-3 gap-y-2 text-[12.5px]">
            <dt className="text-muted-foreground">Reviews</dt>
            <dt className="text-muted-foreground">Lapses</dt>
            <dt className="text-muted-foreground">Stability</dt>
            <dd className="font-medium tabular-nums">{entry.srs.reps}</dd>
            <dd className="font-medium tabular-nums">{entry.srs.lapses}</dd>
            <dd className="font-medium tabular-nums">{entry.srs.state === 0 ? '—' : `${entry.srs.stability.toFixed(1)} d`}</dd>
            <dt className="text-muted-foreground">Difficulty</dt>
            <dt className="col-span-2 text-muted-foreground">Next review</dt>
            <dd className="font-medium tabular-nums">{entry.srs.state === 0 ? '—' : `${entry.srs.difficulty.toFixed(1)} / 10`}</dd>
            <dd className="col-span-2 font-medium">{entry.srs.state === 0 ? 'not started' : formatDate(entry.srs.due, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
          </dl>
          {entry.trouble && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[12px] leading-snug text-amber-900 dark:text-amber-200">
              Marked difficult by {entry.trouble.misses === 1 ? 'a mistake' : `${entry.trouble.misses} mistakes`} in tests. The mark clears after 2 correct test answers in a row ({entry.trouble.streak}/2 so far).
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-2">
          <Button size="sm" variant="ghost" onClick={() => onChange({ suspended: !entry.suspended || undefined })}>
            {entry.suspended ? <Play className="!size-3.5" /> : <Pause className="!size-3.5" />} {entry.suspended ? 'Unsuspend' : 'Suspend'}
          </Button>
          {entry.srs.state !== 0 && (
            <Button size="sm" variant="ghost" onClick={() => void window.api.vocab.reset([entry.id]).then(() => onChange({}))}>
              <RotateCcw className="!size-3.5" /> Reset progress
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="!size-3.5" /> Delete
          </Button>
        </div>
      </div>
    </motion.aside>
  )
}
