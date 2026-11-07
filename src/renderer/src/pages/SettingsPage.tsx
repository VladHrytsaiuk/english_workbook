import { CheckCircle2, FolderOpen, KeyRound, Lock, Monitor, Moon, ShieldAlert, Sun, Trash2, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SHORTCUTS } from '@/lib/shortcuts'
import { useApp, useAsync } from '@/lib/store'
import { englishVoices, setPreferredVoice, speak } from '@/lib/vocab'
import { cn } from '@/lib/utils'
import type { SecretsStatus, ThemePref, TranslationProvider } from '@shared/types'

const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', hint: 'Free tier, fast (default)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', hint: 'Free tier' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', hint: 'Best quality' }
]

const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Best explanations (default)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Faster, cheaper' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Fastest, cheapest' }
]

function Section({ title, description, children, tour }: { title: string; description?: string; children: React.ReactNode; tour?: string }) {
  return (
    <section className="grid grid-cols-[220px_1fr] gap-8 py-8 first:pt-2" data-tour={tour}>
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, description, children }: { label: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{label}</div>
        {description && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, setSettings, reloadContent, toast, bumpData, setTourOpen } = useApp()
  const [secrets, setSecrets] = useState<SecretsStatus | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const { data: cacheSize, reload: reloadCache } = useAsync(() => window.api.translate.cacheSize())
  const { data: dataDir } = useAsync(() => window.api.app.dataDir())
  const { data: version } = useAsync(() => window.api.app.version())

  useEffect(() => {
    void window.api.secrets.status().then(setSecrets)
  }, [])

  if (!settings) return null

  const changeFolder = async (): Promise<void> => {
    const dir = await window.api.content.chooseFolder()
    if (!dir) return
    const { created, settings: next } = await window.api.content.setup(dir)
    setSettings(next)
    await reloadContent()
    toast(created.length ? `Folder connected — added ${created.length} example files.` : 'Folder connected.', 'success')
  }

  const pretty = settings.contentDir?.replace(/^\/Users\/[^/]+/, '~').replace(/^[A-Z]:\\Users\\[^\\]+/i, '~')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[860px] divide-y px-8 pb-16">
          <Section title="Workbook folder" description="Notes and tests are read from Markdown files here. Changes are picked up live.">
            <Card className="flex items-center gap-3 px-4 py-3">
              <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
              <span className="selectable flex-1 truncate font-mono text-[12.5px]">{pretty}</span>
              <Button variant="ghost" size="sm" onClick={() => void window.api.content.openFolder()}>
                Open
              </Button>
              <Button variant="outline" size="sm" onClick={() => void changeFolder()}>
                Change…
              </Button>
            </Card>
            <p className="text-[12.5px] text-muted-foreground">
              Subfolders: <code className="rounded bg-muted px-1">notes/</code> for cheat sheets, <code className="rounded bg-muted px-1">tests/</code> for tests. The full test format is in{' '}
              <code className="rounded bg-muted px-1">TEST_FORMAT.md</code> inside this folder.
            </p>
          </Section>

          <Section title="Appearance">
            <Row label="Theme" description="Follow macOS or pick one.">
              <Segmented<ThemePref>
                value={settings.theme}
                onChange={(theme) => void updateSettings({ theme })}
                options={[
                  { value: 'system', label: 'System', icon: Monitor },
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon }
                ]}
              />
            </Row>
          </Section>

          <Section title="Translation" tour="settings-translation" description="Select text in notes or tests to translate it. API calls go through the app's main process; keys are encrypted with the macOS Keychain.">
            {secrets && !secrets.encryptionAvailable && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12.5px]">
                <ShieldAlert className="mt-px size-4 shrink-0 text-warning" />
                Secure storage is not available, so API keys can't be saved.
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <ProviderCard
                active={settings.provider === 'gemini'}
                title="Gemini"
                description="Free API tier. Translation plus a grammar explanation in context."
                configured={secrets?.gemini}
                onClick={() => void updateSettings({ provider: 'gemini' })}
              />
              <ProviderCard
                active={settings.provider === 'deepl'}
                title="DeepL"
                description="Translation only. The free API plan has a limited character credit."
                configured={secrets?.deepl}
                onClick={() => void updateSettings({ provider: 'deepl' })}
              />
              <ProviderCard
                active={settings.provider === 'claude'}
                title="Claude"
                description="Translation plus a short grammar explanation in context (in Ukrainian)."
                configured={secrets?.claude}
                onClick={() => void updateSettings({ provider: 'claude' })}
              />
            </div>

            <KeyField
              provider="gemini"
              label="Gemini API key"
              placeholder="AIza…"
              help="Create a free key in Google AI Studio (Get API key → Create API key). Works with any Google account; no card needed, and it doesn't depend on a Gemini subscription."
              link="https://aistudio.google.com/apikey"
              saved={secrets?.gemini}
              onStatus={setSecrets}
            />
            <KeyField
              provider="deepl"
              label="DeepL API key"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
              help={<>Free keys end in <code className="rounded bg-muted px-1">:fx</code> and use the Free endpoint automatically.</>}
              link="https://www.deepl.com/your-account/keys"
              saved={secrets?.deepl}
              onStatus={setSecrets}
            />
            <KeyField
              provider="claude"
              label="Claude API key"
              placeholder="sk-ant-…"
              help="Create one in the Claude Console. Usage is billed to your Anthropic account."
              link="https://platform.claude.com/settings/keys"
              saved={secrets?.claude}
              onStatus={setSecrets}
            />

            <Row label="Gemini model" description="Used when Gemini is the provider.">
              <Select value={settings.geminiModel} onValueChange={(geminiModel) => void updateSettings({ geminiModel })}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-72">
                  {GEMINI_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} hint={m.hint}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Claude model" description="Used when Claude is the provider.">
              <Select value={settings.claudeModel} onValueChange={(claudeModel) => void updateSettings({ claudeModel })}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-72">
                  {CLAUDE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id} hint={m.hint}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Translate on select" description="Off: the popover shows a Translate button first (saves quota).">
              <Switch checked={settings.autoTranslate} onCheckedChange={(autoTranslate) => void updateSettings({ autoTranslate })} />
            </Row>
            <Row label="Translation cache" description={`${cacheSize ?? 0} saved translations are reused instead of calling the API again.`}>
              <Button
                variant="outline"
                size="sm"
                disabled={!cacheSize}
                onClick={async () => {
                  const n = await window.api.translate.clearCache()
                  reloadCache()
                  toast(`Cleared ${n} cached translations`)
                }}
              >
                Clear cache
              </Button>
            </Row>
          </Section>

          <Section title="Tests">
            <Row label="Shuffle questions" description="A different order every time. Reading passages keep their questions together.">
              <Switch checked={settings.shuffleQuestions} onCheckedChange={(shuffleQuestions) => void updateSettings({ shuffleQuestions })} />
            </Row>
            <Row label="Shuffle answer options" description="The right option moves around, whatever order the file lists them in.">
              <Switch checked={settings.shuffleAnswers} onCheckedChange={(shuffleAnswers) => void updateSettings({ shuffleAnswers })} />
            </Row>
            <Row label="Forgive small typos in word tests" description="One wrong, missing or extra letter in a vocabulary spelling question still counts as correct (you see the right spelling). Grammar tests stay exact.">
              <Switch checked={settings.forgiveTypos} onCheckedChange={(forgiveTypos) => void updateSettings({ forgiveTypos })} />
            </Row>
            <Row label="Show topic before answering" description="The topic (e.g. “Present Continuous”) is a strong hint, so by default it appears after you answer.">
              <Switch checked={settings.showTopics} onCheckedChange={(showTopics) => void updateSettings({ showTopics })} />
            </Row>
          </Section>

          <Section title="Vocabulary review" description="Spaced repetition with FSRS: each word comes back right before you'd forget it.">
            <Row label="Target memory" description="Chance of remembering a word when it comes back. Higher means more reviews.">
              <Segmented<string>
                value={String(settings.desiredRetention)}
                onChange={(v) => void updateSettings({ desiredRetention: Number(v) })}
                options={[
                  { value: '0.85', label: '85%' },
                  { value: '0.9', label: '90%' },
                  { value: '0.95', label: '95%' }
                ]}
              />
            </Row>
            <Row label="New words per day" description="How many new words are introduced in reviews each day.">
              <Select value={String(settings.newCardsPerDay)} onValueChange={(v) => void updateSettings({ newCardsPerDay: Number(v) })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Reviews per day" description="Upper limit for repeated words, so a backlog never becomes overwhelming.">
              <Select value={String(settings.reviewsPerDay)} onValueChange={(v) => void updateSettings({ reviewsPerDay: Number(v) })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[50, 100, 200, 500].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                  <SelectItem value="100000">No limit</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Practice style" description="Mixed alternates cards, typing, fill-the-gap and multiple choice.">
              <Select value={settings.reviewMode} onValueChange={(v) => void updateSettings({ reviewMode: v as typeof settings.reviewMode })}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed (recommended)</SelectItem>
                  <SelectItem value="flashcard">Flashcards</SelectItem>
                  <SelectItem value="typing">Typing</SelectItem>
                  <SelectItem value="cloze">Fill the gap</SelectItem>
                  <SelectItem value="choice">Multiple choice</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row label="Pronounce words" description="Read words aloud with the macOS voice during review.">
              <Switch checked={settings.speakWords} onCheckedChange={(speakWords) => void updateSettings({ speakWords })} />
            </Row>
            <VoicePicker value={settings.voiceName} onChange={(voiceName) => void updateSettings({ voiceName })} />
          </Section>

          <Section title="Data" description="Words, review history, test results and the mistakes bank are stored in the .workbook folder inside your workbook, so they're backed up and synced with your notes. Settings, API keys and the translation cache stay on this Mac.">
            <Card className="flex items-center gap-3 px-4 py-3">
              <span className="selectable flex-1 truncate font-mono text-[12px] text-muted-foreground">{dataDir}</span>
              <Button variant="ghost" size="sm" onClick={() => void window.api.app.openDataDir()}>
                Show
              </Button>
            </Card>
            <Row label="Reset progress" description="Deletes all test attempts and the mistakes bank. Vocabulary is kept.">
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmReset(true)}>
                <Trash2 /> Reset…
              </Button>
            </Row>
          </Section>

          <Section title="Keyboard">
            <Card className="divide-y text-[13px]">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2">
                  <span className="text-muted-foreground">{v}</span>
                  <Kbd className="h-6 px-2 text-[11.5px]">{k}</Kbd>
                </div>
              ))}
            </Card>
          </Section>

          <Section title="Help">
            <Row label="Guided tour" description="A one-minute walk through every section of the app.">
              <Button variant="outline" size="sm" onClick={() => setTourOpen(true)}>
                Take the tour
              </Button>
            </Row>
          </Section>

          <Section title="About">
            <p className="text-[13px] text-muted-foreground">EnglishWorkbook {version}</p>
          </Section>
        </div>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogTitle>Reset all progress?</DialogTitle>
          <DialogDescription>All attempts, statistics and the mistakes bank will be deleted. This can't be undone. Your vocabulary and content files are not affected.</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await window.api.progress.clear()
                bumpData()
                setConfirmReset(false)
                toast('Progress reset')
              }}
            >
              Reset progress
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange(v: T): void; options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[] }) {
  return (
    <div className="flex rounded-lg border bg-muted/50 p-0.5">
      {options.map((o) => {
        const Icon = o.icon
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-colors',
              value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ProviderCard({ active, title, description, configured, onClick }: { active: boolean; title: string; description: string; configured?: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded-xl border bg-card p-4 text-left transition-colors', active ? 'border-primary ring-1 ring-primary' : 'hover:border-foreground/20')}
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex size-4 items-center justify-center rounded-full border', active && 'border-primary')}>{active && <span className="size-2 rounded-full bg-primary" />}</span>
        <span className="text-[14px] font-semibold">{title}</span>
        {configured ? (
          <Badge variant="success" className="ml-auto whitespace-nowrap">
            Key saved
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto whitespace-nowrap">
            No key
          </Badge>
        )}
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{description}</p>
    </button>
  )
}

function KeyField({
  provider,
  label,
  placeholder,
  help,
  link,
  saved,
  onStatus
}: {
  provider: TranslationProvider
  label: string
  placeholder: string
  help: React.ReactNode
  link: string
  saved?: boolean
  onStatus(s: SecretsStatus): void
}) {
  const { toast } = useApp()
  const [value, setValue] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async (): Promise<void> => {
    try {
      onStatus(await window.api.secrets.set(provider, value))
      setValue('')
      setTestMsg(null)
      toast(`${label} saved (encrypted)`, 'success')
    } catch (e) {
      toast(String(e), 'error')
    }
  }
  const test = async (): Promise<void> => {
    setTesting(true)
    setTestMsg(null)
    const r = await window.api.translate.test(provider)
    setTesting(false)
    setTestMsg(r.ok ? { ok: true, text: `Works: “The bridge has been built.” → “${r.translation}”` } : { ok: false, text: r.message })
  }

  return (
    <Card className="space-y-2.5 p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <span className="text-[13.5px] font-medium">{label}</span>
        {saved && (
          <span className="flex items-center gap-1 text-[12px] text-success">
            <Lock className="size-3" /> saved, encrypted
          </span>
        )}
        <button className="ml-auto text-[12px] text-primary hover:underline" onClick={() => void window.api.app.openExternal(link)}>
          Get a key ↗
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) void save()
        }}
      >
        <Input type="password" autoComplete="off" spellCheck={false} placeholder={saved ? '•••••••• (enter a new key to replace)' : placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="font-mono text-[12.5px]" />
        <Button type="submit" size="default" disabled={!value.trim()}>
          Save
        </Button>
        {saved && (
          <>
            <Button type="button" variant="outline" disabled={testing} onClick={() => void test()}>
              {testing ? 'Testing…' : 'Test'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Remove key"
              onClick={async () => {
                onStatus(await window.api.secrets.clear(provider))
                setTestMsg(null)
                toast(`${label} removed`)
              }}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </form>
      <p className="text-[12px] text-muted-foreground">{help}</p>
      {testMsg && (
        <p className={cn('flex items-start gap-1.5 text-[12.5px]', testMsg.ok ? 'text-success' : 'text-destructive')}>
          {testMsg.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <ShieldAlert className="mt-px size-3.5 shrink-0" />}
          {testMsg.text}
        </p>
      )}
    </Card>
  )
}

function VoicePicker({ value, onChange }: { value: string | null; onChange(v: string | null): void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => englishVoices())
  useEffect(() => {
    const load = (): void => setVoices(englishVoices())
    window.speechSynthesis?.addEventListener('voiceschanged', load)
    load()
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load)
  }, [])
  const AUTO = '__auto__'
  const current = value && voices.some((v) => v.name === value) ? value : AUTO
  const test = (name: string | null): void => {
    setPreferredVoice(name)
    speak('Hello! I really look forward to seeing you next week.')
  }
  return (
    <Row
      label="Voice"
      description={
        <>
          English voices installed on this Mac. Better ones: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → English → a voice marked
          Premium or Enhanced (Siri voices can't be used by apps).
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Select
          value={current}
          onValueChange={(v) => {
            const name = v === AUTO ? null : v
            onChange(name)
            test(name)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72 w-72">
            <SelectItem value={AUTO} hint={voices[0] ? voices[0].name.replace(/\s*\((?:англійська|English).*\)\s*$/i, '') : undefined}>
              Automatic
            </SelectItem>
            {voices.map((v) => (
              <SelectItem key={v.voiceURI} value={v.name} hint={v.lang.replace('_', '-')}>
                {v.name.replace(/\s*\((?:англійська|English).*\)\s*$/i, '')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" title="Listen" onClick={() => test(value)}>
          <Volume2 />
        </Button>
      </div>
    </Row>
  )
}
