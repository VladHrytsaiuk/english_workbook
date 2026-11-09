import { Eye, EyeOff, Play, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useApp, useAsync } from '@/lib/store'
import { cn, pct, plural, shuffle } from '@/lib/utils'
import { buildQueue, GROUP_INFO, GROUPS, inScope, isDueVerb, isKnown, isWeak, ORDER, summarize, type VerbScope, VERBS } from '@shared/irregular'
import type { IrregularGroup, IrregularProgress, IrregularVerb } from '@shared/types'
import { Drill } from './irregular/Drill'

const NEW_CHOICES = [5, 10, 20]

function readNewLimit(): number {
  try {
    const n = Number(localStorage.getItem('irregular.newPerSession'))
    return NEW_CHOICES.includes(n) ? n : 10
  } catch {
    return 10
  }
}

const sameScope = (a: VerbScope, b: VerbScope): boolean => a.kind === b.kind && (a.kind !== 'group' || (b.kind === 'group' && a.group === b.group))

function scopeName(s: VerbScope): string {
  return s.kind === 'top' ? 'Top 60' : s.kind === 'all' ? 'All verbs' : s.kind === 'weak' ? 'Weak verbs' : `Group ${s.group}`
}

export function IrregularPage() {
  const { bumpData } = useApp()
  const { data: progress, reload } = useAsync(() => window.api.irregular.progress())
  const [tab, setTab] = useState<'practice' | 'reference'>('practice')
  const [scope, setScope] = useState<VerbScope | null>(null)
  const [newLimit, setNewLimit] = useState(readNewLimit)
  const [drill, setDrill] = useState<{ queue: IrregularVerb[]; scope: VerbScope } | null>(null)

  const p: IrregularProgress = progress ?? {}
  const now = new Date()
  const all = summarize(VERBS, p, now)
  // Until the 60 most frequent are started, practice those; then everything.
  const topDone = summarize(ORDER.filter((v) => v.top), p, now).started === 60
  const current: VerbScope = scope ?? (topDone ? { kind: 'all' } : { kind: 'top' })
  const queue = useMemo(() => buildQueue(current, p, now, newLimit, shuffle), [current.kind, (current as { group?: number }).group, progress, newLimit]) // eslint-disable-line react-hooks/exhaustive-deps

  if (drill)
    return (
      <Drill
        queue={drill.queue}
        title={scopeName(drill.scope)}
        onExit={() => {
          setDrill(null)
          reload()
          bumpData()
        }}
      />
    )

  const dueNow = queue.filter((v) => isDueVerb(p[v.id], now)).length
  const newNow = queue.length - dueNow

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Irregular verbs"
        subtitle={progress ? `${all.started} of ${all.total} started · ${all.known} known${all.due ? ` · ${all.due} due` : ''}` : ' '}
        actions={
          <div className="flex rounded-lg border p-0.5 text-[13px]">
            {(['practice', 'reference'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn('rounded-md px-3 py-1 capitalize transition-colors', tab === t ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground')}>
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto" data-scroll>
        <div className="mx-auto max-w-[900px] space-y-6 px-8 py-6">
          {tab === 'practice' ? (
            <>
              <Card className="flex flex-wrap items-center gap-4 p-5" data-tour="irregular-start">
                <div className="min-w-[220px] flex-1">
                  <div className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">{scopeName(current)}</div>
                  <div className="mt-1 text-[20px] font-semibold tracking-tight">
                    {queue.length ? `${plural(dueNow, 'verb')} to review${newNow ? ` · ${newNow} new` : ''}` : 'Nothing to practise here yet'}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">You see the infinitive and type the past simple and the past participle. Wrong verbs come back a few cards later and are scheduled sooner (FSRS).</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button size="lg" disabled={!queue.length} onClick={() => setDrill({ queue, scope: current })}>
                    <Play /> Start
                  </Button>
                  <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    New per session
                    <select
                      value={newLimit}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        setNewLimit(n)
                        try {
                          localStorage.setItem('irregular.newPerSession', String(n))
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="rounded border bg-background px-1 py-0.5 text-[12px]"
                    >
                      {NEW_CHOICES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Card>

              <div>
                <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">What to practise</h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <ScopeCard label="Top 60" hint="The most frequent verbs — start here" scope={{ kind: 'top' }} current={current} progress={p} onPick={setScope} />
                  <ScopeCard label="All verbs" hint={`${VERBS.length} verbs, the top 60 first`} scope={{ kind: 'all' }} current={current} progress={p} onPick={setScope} />
                  {GROUPS.map((g) => (
                    <ScopeCard key={g} label={`${g}. ${GROUP_INFO[g].title}`} hint={g === 6 ? GROUP_INFO[g].example : `${GROUP_INFO[g].scheme} · ${GROUP_INFO[g].example}`} scope={{ kind: 'group', group: g }} current={current} progress={p} onPick={setScope} />
                  ))}
                  <ScopeCard label="Weak verbs" hint="Forgotten more than once or hard for you" scope={{ kind: 'weak' }} current={current} progress={p} onPick={setScope} />
                </div>
                {current.kind === 'group' && (
                  <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
                    <b>{GROUP_INFO[current.group].scheme}</b> — {GROUP_INFO[current.group].tip}
                  </p>
                )}
              </div>
            </>
          ) : (
            <Reference progress={p} />
          )}
        </div>
      </div>
    </div>
  )
}

function ScopeCard({ label, hint, scope, current, progress, onPick }: { label: string; hint: string; scope: VerbScope; current: VerbScope; progress: IrregularProgress; onPick: (s: VerbScope) => void }) {
  const verbs = inScope(scope, progress)
  const s = summarize(verbs, progress, new Date())
  const on = sameScope(scope, current)
  const weak = scope.kind === 'weak'
  return (
    <button onClick={() => onPick(scope)} className={cn('rounded-xl border p-3.5 text-left transition-colors', on ? 'border-primary bg-primary/[0.05]' : 'hover:bg-accent/50')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-medium">{label}</span>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">{weak ? plural(verbs.length, 'verb') : `${s.started}/${s.total}`}</span>
      </div>
      <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{hint}</div>
      {!weak && <Progress value={pct(s.started, s.total)} className="mt-2.5" />}
    </button>
  )
}

const STATUS: { test: (c: IrregularProgress[string] | undefined) => boolean; label: string; dot: string }[] = [
  { test: (c) => isWeak(c), label: 'weak', dot: 'bg-destructive' },
  { test: (c) => isKnown(c), label: 'known', dot: 'bg-emerald-500' },
  { test: (c) => Boolean(c) && c!.state !== 0, label: 'learning', dot: 'bg-amber-500' }
]

function Reference({ progress }: { progress: IrregularProgress }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<IrregularGroup | 0>(0)
  const [cover, setCover] = useState(false)
  const [shown, setShown] = useState<Set<string>>(new Set())
  const q = query.trim().toLowerCase()
  const rows = ORDER.filter((v) => (!group || v.group === group) && (!q || `${v.v1} ${v.v2} ${v.v3} ${v.uk}`.toLowerCase().includes(q)))
  const reveal = (id: string): void => setShown((s) => new Set(s).add(id))
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a verb or a translation" className="h-8 w-[240px] rounded-lg border bg-background pl-8 pr-2 text-[13px] outline-none focus:border-ring/50" />
        </div>
        <select value={group} onChange={(e) => setGroup(Number(e.target.value) as IrregularGroup | 0)} className="h-8 rounded-lg border bg-background px-2 text-[13px]">
          <option value={0}>All groups</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}. {GROUP_INFO[g].title}
            </option>
          ))}
        </select>
        <Button
          variant={cover ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setCover((c) => !c)
            setShown(new Set())
          }}
        >
          {cover ? <EyeOff /> : <Eye />} Cover V2 &amp; V3
        </Button>
        <span className="ml-auto text-[12px] text-muted-foreground">{plural(rows.length, 'verb')}</span>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-[13.5px]">
          <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
            <tr>
              <th className="w-6 py-2 pl-3" />
              <th className="px-3 py-2 font-medium">V1</th>
              <th className="px-3 py-2 font-medium">V2 · Past Simple</th>
              <th className="px-3 py-2 font-medium">V3 · Participle</th>
              <th className="px-3 py-2 font-medium">Українською</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const st = STATUS.find((s) => s.test(progress[v.id]))
              const hidden = cover && !shown.has(v.id)
              return (
                <tr key={v.id} className="border-t" onClick={() => cover && reveal(v.id)}>
                  <td className="py-2 pl-3">{st && <span title={st.label} className={cn('block size-2 rounded-full', st.dot)} />}</td>
                  <td className="px-3 py-2 font-semibold">{v.v1}</td>
                  <td className={cn('px-3 py-2', hidden && 'select-none text-transparent [text-shadow:0_0_8px_currentColor]')}>{v.v2}</td>
                  <td className={cn('px-3 py-2', hidden && 'select-none text-transparent [text-shadow:0_0_8px_currentColor]')}>{v.v3}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.uk}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {cover && <p className="mt-2 text-[12px] text-muted-foreground">Click a row to reveal it.</p>}
    </div>
  )
}
