import { BarChart3, BookOpen, CalendarCheck, CircleHelp, Languages, ListChecks, Monitor, Moon, PenLine, Play, Settings as SettingsIcon, Shuffle, Sun } from 'lucide-react'
import { useState } from 'react'
import { HelpDialog } from './HelpDialog'
import { UpdateBanner } from './UpdateBanner'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { useKeydown } from '@/hooks/useHotkey'
import { type Page, type Route, useApp, useAsync } from '@/lib/store'
import { cn, modKey } from '@/lib/utils'
import { isDue } from '@shared/srs'
import type { ThemePref } from '@shared/types'
import { Tooltip } from './ui/tooltip'

const NAV: { page: Page; label: string; icon: LucideIcon; route: Route }[] = [
  {
    page: 'today',
    label: 'Today',
    icon: CalendarCheck,
    route: { page: 'today' }
  },
  { page: 'notes', label: 'Notes', icon: BookOpen, route: { page: 'notes' } },
  { page: 'tests', label: 'Tests', icon: ListChecks, route: { page: 'tests' } },
  {
    page: 'vocab',
    label: 'Vocabulary',
    icon: Languages,
    route: { page: 'vocab' }
  },
  {
    page: 'writing',
    label: 'Writing',
    icon: PenLine,
    route: { page: 'writing' }
  },
  {
    page: 'irregular',
    label: 'Irregular verbs',
    icon: Shuffle,
    route: { page: 'irregular' }
  },
  { page: 'stats', label: 'Stats', icon: BarChart3, route: { page: 'stats' } },
  {
    page: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    route: { page: 'settings' }
  }
]

const THEMES: { value: ThemePref; icon: LucideIcon; label: string }[] = [
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' }
]

export function Sidebar() {
  const { route, navigate, pausedRun, notes, tests, settings, updateSettings } = useApp()
  const [helpOpen, setHelpOpen] = useState(false)
  const { data: vocab } = useAsync(() => window.api.vocab.list())
  const { data: mistakes } = useAsync(() => window.api.progress.mistakes())
  const active: Page = route.page === 'run' ? 'tests' : route.page === 'review' ? 'vocab' : route.page

  useKeydown((e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
    const n = Number(e.key)
    if (n >= 1 && n <= NAV.length) {
      e.preventDefault()
      navigate(NAV[n - 1].route)
    } else if (e.key === ',') {
      e.preventDefault()
      navigate({ page: 'settings' })
    }
  })

  const dueWords = vocab?.filter((v) => isDue(v, new Date())).length ?? 0
  const counts: Partial<Record<Page, number | undefined>> = {
    notes: notes.length,
    tests: tests.length,
    vocab: dueWords ? undefined : vocab?.length,
    stats: mistakes?.length || undefined
  }

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r bg-sidebar">
      <div className={cn('drag shrink-0', window.api.platform === 'darwin' ? 'h-[52px]' : 'h-4')} />
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[13px] font-bold text-white shadow-sm">Ew</div>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold tracking-tight">EnglishWorkbook</div>
            <div className="text-[11px] text-muted-foreground">Personal study kit</div>
          </div>
        </div>
      </div>
      {pausedRun && (
        <button
          onClick={() => navigate(pausedRun)}
          className="mx-2.5 mb-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.07] px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-primary/[0.12]"
        >
          <Play className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block font-medium">Test in progress</span>
            <span className="block truncate text-muted-foreground">Tap to continue</span>
          </span>
        </button>
      )}
      <nav className="flex flex-1 flex-col gap-0.5 px-2.5" data-tour="nav">
        {NAV.map((item, i) => {
          const isActive = active === item.page
          const Icon = item.icon
          const count = counts[item.page]
          return (
            <button
              key={item.page}
              onClick={() => navigate(item.route)}
              className={cn(
                'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors',
                isActive ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                item.page === 'settings' && 'mt-auto'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg border bg-background shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <Icon className="relative size-4" />
              <span className="relative flex-1 text-left">{item.label}</span>
              {count !== undefined && count > 0 && item.page !== 'stats' && <span className="relative text-[11.5px] tabular-nums text-muted-foreground">{count}</span>}
              {item.page === 'vocab' && dueWords > 0 && (
                <Tooltip content={`${dueWords} ${dueWords === 1 ? 'word' : 'words'} to review`}>
                  <span className="relative rounded-full bg-primary px-1.5 text-[10.5px] font-semibold tabular-nums text-primary-foreground">{dueWords}</span>
                </Tooltip>
              )}
              {item.page === 'stats' && count ? (
                <Tooltip content={`${count} in mistakes bank`}>
                  <span className="relative rounded-full bg-destructive/12 px-1.5 text-[10.5px] font-semibold tabular-nums text-destructive">{count}</span>
                </Tooltip>
              ) : null}
              <span className="relative hidden text-[10.5px] text-muted-foreground/70 group-hover:inline">
                {modKey}
                {item.page === 'settings' ? ',' : i + 1}
              </span>
            </button>
          )
        })}
      </nav>
      <UpdateBanner />
      <div className="flex items-center gap-1.5 p-3">
        <Tooltip content="Help & tour" side="top">
          <button
            data-tour="help"
            onClick={() => setHelpOpen(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Help"
          >
            <CircleHelp className="size-4" />
          </button>
        </Tooltip>
        <div className="flex flex-1 rounded-lg border bg-background/60 p-0.5">
          {THEMES.map((t) => {
            const Icon = t.icon
            const on = settings?.theme === t.value
            return (
              <Tooltip key={t.value} content={`${t.label} theme`} side="top">
                <button
                  onClick={() => void updateSettings({ theme: t.value })}
                  className={cn(
                    'flex h-7 flex-1 items-center justify-center rounded-md transition-colors',
                    on ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={`${t.label} theme`}
                >
                  <Icon className="size-3.5" />
                </button>
              </Tooltip>
            )
          })}
        </div>
      </div>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </aside>
  )
}
