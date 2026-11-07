import { motion } from 'framer-motion'
import { ArrowLeft, Check, FolderOpen, LoaderCircle, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { cn, plural } from '@/lib/utils'
import { countWords, wordsUsed } from '@shared/writing'
import type { WritingEntry } from '@shared/types'
import { EvaluationView } from './EvaluationView'

const MIN_TO_SUBMIT = 30

export function EssayView({ entry }: { entry: WritingEntry }) {
  const { navigate, bumpData, toast } = useApp()
  const [text, setText] = useState(entry.text)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const latest = useRef(text)
  const saved = useRef(entry.text)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draft = entry.status === 'draft'

  const words = countWords(text)
  const min = entry.minWords ?? 120
  const max = entry.maxWords ?? 200
  const used = useMemo(() => wordsUsed(text, entry.targetWords), [text, entry.targetWords])

  // Autosave: shortly after typing stops, and when leaving the page.
  const flush = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (draft && latest.current !== saved.current) {
      saved.current = latest.current
      void window.api.writing.saveText(entry.id, latest.current)
    }
  }
  useEffect(() => flush, []) // eslint-disable-line react-hooks/exhaustive-deps
  const onChange = (v: string): void => {
    setText(v)
    latest.current = v
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 700)
  }

  const submit = async (): Promise<void> => {
    flush()
    setBusy(true)
    setError('')
    const r = await window.api.writing.evaluate(entry.id)
    setBusy(false)
    if (r.ok) bumpData()
    else setError(r.message)
  }

  const remove = async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    latest.current = saved.current
    await window.api.writing.remove(entry.id)
    bumpData()
    toast('Deleted')
    navigate({ page: 'writing' })
  }

  const header = (
    <header className="drag flex h-[64px] shrink-0 items-center gap-3 border-b px-6">
      <Button variant="ghost" size="sm" className="no-drag -ml-2 text-muted-foreground" onClick={() => navigate({ page: 'writing' })}>
        <ArrowLeft /> Writing
      </Button>
      <span className="text-muted-foreground/50">/</span>
      <span className="truncate text-[13px] font-medium">{entry.title}</span>
      <div className="no-drag ml-auto flex items-center gap-1">
        {!draft && (
          <Button variant="ghost" size="icon-sm" title="Open the writing folder" onClick={() => void window.api.content.openFolder('writing')}>
            <FolderOpen />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => void remove()}>
          <Trash2 />
        </Button>
      </div>
    </header>
  )

  if (!draft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[860px] px-8 pb-20 pt-8">
            <div className="mb-6">
              <h1 className="text-[24px] font-semibold tracking-tight">{entry.title}</h1>
              <div className="selectable mt-2 max-w-[700px] text-[13.5px] text-muted-foreground" data-translate="other" data-source-title={entry.title}>
                <Markdown className="text-[13.5px] [&_li]:my-0.5 [&_p]:my-1">{entry.prompt}</Markdown>
              </div>
            </div>
            <EvaluationView entry={entry} />
            <div className="mt-8 flex gap-2">
              <Button onClick={() => navigate({ page: 'writing', start: 'essay' })}>Write another text</Button>
              <Button variant="ghost" onClick={() => navigate({ page: 'writing' })}>
                Back to Writing
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tone = words < min ? 'text-muted-foreground' : words <= max ? 'text-success' : 'text-warning'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="flex min-h-0 flex-1">
        <aside className="w-[340px] shrink-0 overflow-y-auto border-r bg-muted/25 px-6 py-6">
          <Badge variant="secondary">Essay · {min}–{max} words</Badge>
          <h2 className="mt-3 text-[18px] font-semibold tracking-tight">{entry.title}</h2>
          <div className="selectable mt-2" data-translate="other" data-source-title={entry.title}>
            <Markdown className="text-[14px] leading-relaxed [&_li]:my-0.5 [&_ul]:my-2">{entry.prompt}</Markdown>
          </div>
          {entry.targetWords.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Try to use your words</div>
              <div className="flex flex-wrap gap-1.5">
                {entry.targetWords.map((w) => (
                  <span key={w} className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] transition-colors', used.has(w) ? 'border-success/50 bg-success/10' : 'bg-background')}>
                    {used.has(w) && <Check className="size-3.5 text-success" />}
                    {w}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Any form counts: <i>give up</i> is found in <i>gave up</i>.</p>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoFocus
            placeholder="Start writing here…"
            className="min-h-0 flex-1 resize-none bg-background px-10 py-8 text-[16px] leading-[1.8] outline-none placeholder:text-muted-foreground"
          />
          {error && (
            <div className="mx-10 mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </div>
          )}
          <footer className="flex h-[64px] shrink-0 items-center justify-between gap-4 border-t px-10">
            <div className="flex items-center gap-3 text-[13px]">
              <span className={cn('font-medium tabular-nums', tone)}>{plural(words, 'word')}</span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
                <motion.div className={cn('h-full rounded-full', words >= min ? 'bg-success' : 'bg-primary')} animate={{ width: `${Math.min(100, (words / min) * 100)}%` }} />
              </div>
              <span className="text-muted-foreground">
                {words < min ? `${min - words} more to reach ${min}` : words <= max ? 'good length' : `${words - max} over the limit — that's fine, but try to be concise`}
              </span>
            </div>
            <Button disabled={busy || words < MIN_TO_SUBMIT} onClick={() => void submit()} title={words < MIN_TO_SUBMIT ? `Write at least ${MIN_TO_SUBMIT} words` : undefined}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Send />} {busy ? 'Checking your text…' : 'Get feedback'}
            </Button>
          </footer>
        </div>
      </div>
    </div>
  )
}
