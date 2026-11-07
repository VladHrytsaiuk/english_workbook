import { motion } from 'framer-motion'
import { ArrowLeft, Check, FolderOpen, Lightbulb, LoaderCircle, SendHorizontal, Sparkles, Target, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { WritingEntry } from '@shared/types'
import { EvaluationView } from './EvaluationView'

const MIN_TO_FINISH = 2

export function ChatView({ entry }: { entry: WritingEntry }) {
  const { navigate, bumpData, toast } = useApp()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const draft = entry.status === 'draft'
  const mine = entry.messages.filter((m) => m.role === 'user').length

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entry.messages.length, sending])
  useEffect(() => {
    if (draft && !sending) box.current?.focus()
  }, [draft, sending])

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || sending || finishing) return
    setSending(true)
    setError('')
    const r = await window.api.writing.chatTurn(entry.id, text)
    setSending(false)
    if (r.ok) {
      setInput('')
      bumpData()
    } else setError(r.message) // the message stays in the box, so nothing is lost
  }

  const finish = async (): Promise<void> => {
    setFinishing(true)
    setError('')
    const r = await window.api.writing.evaluate(entry.id)
    setFinishing(false)
    if (r.ok) bumpData()
    else setError(r.message)
  }

  const remove = async (): Promise<void> => {
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
      {entry.register && <Badge variant="secondary">{entry.register}</Badge>}
      <div className="no-drag ml-auto flex items-center gap-1">
        {!draft && (
          <Button variant="ghost" size="icon-sm" title="Open the writing folder" onClick={() => void window.api.content.openFolder('writing')}>
            <FolderOpen />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => void remove()}>
          <Trash2 />
        </Button>
        {draft && (
          <Button size="sm" variant={entry.chatDone ? 'default' : 'outline'} disabled={mine < MIN_TO_FINISH || sending || finishing} onClick={() => void finish()} title={mine < MIN_TO_FINISH ? 'Write at least two messages' : undefined}>
            {finishing ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {finishing ? 'Evaluating…' : 'Finish & get feedback'}
          </Button>
        )}
      </div>
    </header>
  )

  if (!draft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[860px] px-8 pb-20 pt-8">
            <h1 className="text-[24px] font-semibold tracking-tight">{entry.title}</h1>
            <p className="mt-2 max-w-[700px] text-[13.5px] text-muted-foreground">{entry.prompt}</p>
            <div className="mt-6">
              <EvaluationView entry={entry} />
            </div>
            <div className="mt-8 flex gap-2">
              <Button onClick={() => navigate({ page: 'writing' })}>Start another conversation</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="flex-1 overflow-y-auto" data-translate="other" data-source-title={entry.title}>
        <div className="mx-auto max-w-[760px] px-8 pb-6 pt-6">
          {/* Situation and goals */}
          <div className="mb-6 rounded-xl border bg-muted/30 px-5 py-4">
            <p className="selectable text-[14px] leading-relaxed">{entry.prompt}</p>
            {(entry.goals?.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                {entry.goals?.map((g) => (
                  <li key={g} className="flex gap-2">
                    <Target className="mt-0.5 size-3.5 shrink-0 text-primary" /> {g}
                  </li>
                ))}
              </ul>
            )}
            {entry.targetWords.length > 0 && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Try to use: <span className="font-medium text-foreground">{entry.targetWords.join(' · ')}</span>
              </p>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              You are talking to <span className="font-medium text-foreground">{entry.aiRole ?? 'a partner'}</span>. Select any English text to translate it.
            </p>
          </div>

          <div className="space-y-3">
            {entry.messages.length === 0 && <p className="py-6 text-center text-[13.5px] text-muted-foreground">You start: write your first message below.</p>}
            {entry.messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                <div className={cn('selectable max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card')}>{m.content}</div>
                {m.tip && (
                  <div className="selectable mt-1.5 flex max-w-[85%] items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-[12.5px] leading-snug text-foreground">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" /> {m.tip}
                  </div>
                )}
              </motion.div>
            ))}
            {sending && (
              <div className="flex items-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border bg-card px-4 py-3">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} className="size-1.5 rounded-full bg-muted-foreground/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }} />
                  ))}
                </div>
              </div>
            )}
            {entry.chatDone && !sending && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-[13.5px]">
                <Check className="size-4 text-success" /> The conversation has come to an end — press <b>Finish &amp; get feedback</b>.
              </div>
            )}
            <div ref={bottom} />
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t px-6 py-3">
        <div className="mx-auto max-w-[760px]">
          {error && <div className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error} Your message is still in the box.</div>}
          <div className="flex items-end gap-2">
            <textarea
              ref={box}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              rows={2}
              disabled={sending || finishing}
              spellCheck={false}
              placeholder="Write your message… (Enter to send, Shift+Enter for a new line)"
              className="min-h-[56px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/60 disabled:opacity-60"
            />
            <Button size="icon" className="size-[56px] rounded-xl" disabled={!input.trim() || sending || finishing} onClick={() => void send()} aria-label="Send">
              {sending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
