import { RefreshCw, Shuffle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ChatScenario } from '@shared/chatScenarios'
import type { NewWritingEntry, VocabEntry } from '@shared/types'
import { filterBySource, pickWords } from '@shared/wordTest'
import { TASK_KIND_LABEL, monthKey, taskForMonth } from '@shared/writingTasks'

/** Words to practise in a text or a conversation: practised, not mastered yet (then any practised word). */
function suggestWords(vocab: VocabEntry[], n: number): string[] {
  const now = new Date()
  const studying = filterBySource(vocab, 'studying', now)
  const pool = studying.length >= n ? studying : filterBySource(vocab, 'all', now)
  return pickWords(pool, n).map((w) => w.text.trim().replace(/^to\s+/i, ''))
}

function WordsToggle({ words, enabled, onToggle, onShuffle, available }: { words: string[]; enabled: boolean; onToggle(v: boolean): void; onShuffle(): void; available: boolean }) {
  return (
    <div className={cn('rounded-xl border px-4 py-3', !available && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">Practise my words</div>
          <div className="text-[12px] text-muted-foreground">{available ? 'The task suggests words you have practised, so they stick in your active vocabulary.' : 'Practise a few words in Vocabulary first.'}</div>
        </div>
        {available && enabled && (
          <Button variant="ghost" size="icon-sm" title="Pick other words" onClick={onShuffle}>
            <Shuffle />
          </Button>
        )}
        <Switch checked={enabled && available} disabled={!available} onCheckedChange={onToggle} />
      </div>
      {available && enabled && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {words.map((w) => (
            <span key={w} className="rounded-lg border bg-muted/50 px-2.5 py-1 text-[13px]">
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function StartEssayDialog({ open, onClose, vocab }: { open: boolean; onClose(): void; vocab: VocabEntry[] }) {
  const { navigate, bumpData, toast } = useApp()
  const [offset, setOffset] = useState(0)
  const [custom, setCustom] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [useWords, setUseWords] = useState(true)
  const [words, setWords] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [wasOpen, setWasOpen] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setOffset(0)
      setCustom(false)
      setTitle('')
      setPrompt('')
      setUseWords(true)
      setWords(suggestWords(vocab, 5))
      setBusy(false)
    }
  }

  const task = useMemo(() => taskForMonth(monthKey(), offset), [offset])
  const available = words.length >= 3
  const canStart = !busy && (!custom || prompt.trim().length >= 10)

  const start = async (): Promise<void> => {
    setBusy(true)
    const input: NewWritingEntry = custom
      ? { kind: 'essay', title: title.trim() || 'My topic', prompt: prompt.trim(), taskId: 'custom', targetWords: useWords && available ? words : [], minWords: 100, maxWords: 200 }
      : { kind: 'essay', title: task.title, prompt: task.prompt, taskId: task.id, targetWords: useWords && available ? words : [], minWords: task.minWords, maxWords: task.maxWords }
    const entry = await window.api.writing.create(input)
    bumpData()
    onClose()
    toast('Draft saved automatically as you write')
    navigate({ page: 'writing', entryId: entry.id })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle>Writing of the month</DialogTitle>
        <DialogDescription>Write a text of 120–200 words. An AI checks it and shows your mistakes, with explanations and a corrected version.</DialogDescription>

        {!custom ? (
          <div className="rounded-xl border bg-muted/30 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{TASK_KIND_LABEL[task.kind]}</Badge>
              <span className="text-[12px] text-muted-foreground">
                {task.minWords}–{task.maxWords} words
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setOffset((o) => o + 1)}>
                <RefreshCw className="!size-3.5" /> Another task
              </Button>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold">{task.title}</h3>
            <Markdown className="mt-1 text-[13.5px] leading-relaxed [&_li]:my-0.5 [&_p]:my-1 [&_ul]:my-1.5">{task.prompt}</Markdown>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <Input autoFocus placeholder="Title, e.g. My trip to Lviv" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="What do you want to write about? Describe the task (who the reader is and what to include)." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
          </div>
        )}

        <WordsToggle words={words} enabled={useWords} onToggle={setUseWords} onShuffle={() => setWords(suggestWords(vocab, 5))} available={available} />

        <div className="flex items-center justify-between gap-2">
          <button className="text-[12.5px] text-primary hover:underline" onClick={() => setCustom((c) => !c)}>
            {custom ? '← Use a suggested task' : 'Write on my own topic'}
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!canStart} onClick={() => void start()}>
              Start writing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** `scenario` is a ready-made situation, 'custom' lets the learner describe their own, null = closed. */
export function StartChatDialog({ scenario, onClose, vocab }: { scenario: ChatScenario | 'custom' | null; onClose(): void; vocab: VocabEntry[] }) {
  const { navigate, bumpData } = useApp()
  const [useWords, setUseWords] = useState(false)
  const [words, setWords] = useState<string[]>([])
  const [situation, setSituation] = useState('')
  const [role, setRole] = useState('')
  const [register, setRegister] = useState<'formal' | 'informal'>('informal')
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState<typeof scenario>(null)

  if (scenario !== shown) {
    setShown(scenario)
    if (scenario) {
      setWords(suggestWords(vocab, 3))
      setUseWords(false)
      setSituation('')
      setRole('')
      setGoal('')
      setRegister('informal')
      setBusy(false)
    }
  }

  const available = words.length >= 3
  const isCustom = scenario === 'custom'
  const canStart = !busy && (!isCustom || (situation.trim().length >= 10 && role.trim().length >= 3))

  const start = async (): Promise<void> => {
    if (!scenario) return
    setBusy(true)
    const targetWords = useWords && available ? words : []
    const input: NewWritingEntry =
      scenario === 'custom'
        ? {
            kind: 'chat',
            title: situation.trim().slice(0, 60),
            prompt: situation.trim(),
            scenarioId: 'custom',
            aiRole: role.trim(),
            register,
            goals: goal.trim() ? [goal.trim()] : [],
            targetWords
          }
        : { kind: 'chat', title: scenario.title, prompt: scenario.description, scenarioId: scenario.id, aiRole: scenario.aiRole, register: scenario.register, goals: scenario.goals, targetWords, opening: scenario.opening || undefined }
    const entry = await window.api.writing.create(input)
    bumpData()
    onClose()
    navigate({ page: 'writing', entryId: entry.id })
  }

  return (
    <Dialog open={scenario !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[540px]">
        <DialogTitle>{scenario === 'custom' ? 'Your own situation' : (scenario?.title ?? '')}</DialogTitle>
        <DialogDescription>An AI plays the other person. Write as you would in real life; at the end you get feedback and a score.</DialogDescription>

        {scenario && scenario !== 'custom' && (
          <div className="rounded-xl border bg-muted/30 px-4 py-3.5 text-[13.5px] leading-relaxed">
            <p>{scenario.description}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
              {scenario.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Badge variant="secondary">{scenario.register}</Badge> You talk to {scenario.aiRole}.{!scenario.opening && ' You write first.'}
            </div>
          </div>
        )}
        {scenario === 'custom' && (
          <div className="grid gap-2.5">
            <Textarea autoFocus rows={3} placeholder="Describe the situation, e.g. You are in a shop and want to return a jacket." value={situation} onChange={(e) => setSituation(e.target.value)} />
            <Input placeholder="Who is the other person? e.g. a shop assistant" value={role} onChange={(e) => setRole(e.target.value)} />
            <Input placeholder="What do you want to achieve? (optional)" value={goal} onChange={(e) => setGoal(e.target.value)} />
            <div className="flex w-fit rounded-lg border bg-muted/50 p-0.5">
              {(['informal', 'formal'] as const).map((r) => (
                <button key={r} onClick={() => setRegister(r)} className={cn('h-7 rounded-md px-3 text-[12.5px] font-medium capitalize transition-colors', register === r ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        <WordsToggle words={words} enabled={useWords} onToggle={setUseWords} onShuffle={() => setWords(suggestWords(vocab, 3))} available={available} />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canStart} onClick={() => void start()}>
            Start
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
