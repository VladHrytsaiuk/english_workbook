import { AlertTriangle, BookOpen, Check, Clock, FileText, FolderOpen, FolderPlus, GraduationCap, Hash, Layers, ListChecks, Pencil, PencilLine, RefreshCw, Sparkles, Sprout, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type SmartId, type VocabScope, inScope, scopeKey, SMART_LABELS, SOURCE_LABELS } from '@/lib/vocab'
import type { Deck, VocabEntry } from '@shared/types'

const SMART: { id: SmartId; icon: LucideIcon }[] = [
  { id: 'all', icon: Layers },
  { id: 'due', icon: Clock },
  { id: 'new', icon: Sprout },
  { id: 'learning', icon: BookOpen },
  { id: 'difficult', icon: AlertTriangle },
  { id: 'mastered', icon: GraduationCap },
  { id: 'suspended', icon: X }
]

function NavItem({
  active,
  onClick,
  icon: Icon,
  dot,
  label,
  count,
  accent,
  actions
}: {
  active: boolean
  onClick(): void
  icon?: LucideIcon
  dot?: string
  label: string
  count?: number
  accent?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
          active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" />}
        {dot && <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />}
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className={cn('text-[11px] tabular-nums group-hover:opacity-0', accent ? 'rounded-full bg-primary px-1.5 font-semibold text-primary-foreground' : 'text-muted-foreground', !actions && 'group-hover:opacity-100')}>
            {count}
          </span>
        )}
      </button>
      {actions && <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">{actions}</div>}
    </div>
  )
}

function Heading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-1 mt-5 flex items-center justify-between px-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{children}</span>
      {action}
    </div>
  )
}

export function LibraryNav({
  entries,
  decks,
  scope,
  onScope,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onAutoGroup,
  onRescan,
  grouping
}: {
  entries: VocabEntry[]
  decks: Deck[]
  scope: VocabScope
  onScope(s: VocabScope): void
  onCreateDeck(name: string): void
  onRenameDeck(id: string, name: string): void
  onDeleteDeck(deck: Deck): void
  onAutoGroup(): void
  onRescan(): void
  grouping: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const now = useMemo(() => new Date(), [entries])
  const active = scopeKey(scope)

  const counts = useMemo(() => {
    const c = (s: VocabScope): number => entries.filter((e) => inScope(e, s, now)).length
    const topics = new Map<string, number>()
    const tags = new Map<string, number>()
    for (const e of entries) {
      if (e.topic) topics.set(e.topic, (topics.get(e.topic) ?? 0) + 1)
      for (const t of e.tags) tags.set(t, (tags.get(t) ?? 0) + 1)
    }
    return {
      smart: Object.fromEntries(SMART.map((s) => [s.id, c({ kind: 'smart', id: s.id })])) as Record<SmartId, number>,
      decks: Object.fromEntries(decks.map((d) => [d.id, c({ kind: 'deck', id: d.id })])) as Record<string, number>,
      noDeck: c({ kind: 'deck', id: 'none' }),
      sources: { note: c({ kind: 'source', id: 'note' }), test: c({ kind: 'source', id: 'test' }), other: c({ kind: 'source', id: 'other' }), file: c({ kind: 'source', id: 'file' }) },
      files: [...entries.reduce((m, e) => (e.source.kind === 'file' && e.source.ref ? m.set(e.source.ref, (m.get(e.source.ref) ?? 0) + 1) : m), new Map<string, number>()).entries()].sort((a, b) => a[0].localeCompare(b[0])),
      topics: [...topics.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
      tags: [...tags.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      untopiced: entries.filter((e) => !e.topic).length
    }
  }, [entries, decks, now])

  const submitDeck = (): void => {
    if (draft.trim()) {
      if (renaming) onRenameDeck(renaming, draft.trim())
      else onCreateDeck(draft.trim())
    }
    setDraft('')
    setAdding(false)
    setRenaming(null)
  }

  const deckInput = (
    <form
      className="flex items-center gap-1 px-1 py-0.5"
      onSubmit={(e) => {
        e.preventDefault()
        submitDeck()
      }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submitDeck}
        onKeyDown={(e) => e.key === 'Escape' && (setAdding(false), setRenaming(null), setDraft(''))}
        placeholder="Deck name"
        className="h-7 min-w-0 flex-1 rounded-md border border-ring/50 bg-background px-2 text-[13px] outline-none"
      />
      <button type="submit" className="rounded p-1 text-muted-foreground hover:text-foreground">
        <Check className="size-3.5" />
      </button>
    </form>
  )

  return (
    <nav className="flex w-[216px] shrink-0 flex-col overflow-y-auto border-r px-2 pb-6 pt-3" data-tour="vocab-nav">
      {SMART.map((s) => (
        <NavItem
          key={s.id}
          icon={s.icon}
          label={SMART_LABELS[s.id]}
          count={counts.smart[s.id]}
          accent={s.id === 'due'}
          active={active === `smart:${s.id}`}
          onClick={() => onScope({ kind: 'smart', id: s.id })}
        />
      ))}

      <Heading
        action={
          <button title="New deck" onClick={() => (setAdding(true), setRenaming(null), setDraft(''))} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <FolderPlus className="size-3.5" />
          </button>
        }
      >
        Decks
      </Heading>
      {decks.map((d) =>
        renaming === d.id ? (
          <div key={d.id}>{deckInput}</div>
        ) : (
          <NavItem
            key={d.id}
            dot={d.color}
            label={d.name}
            count={counts.decks[d.id]}
            active={active === `deck:${d.id}`}
            onClick={() => onScope({ kind: 'deck', id: d.id })}
            actions={
              <>
                <button title="Rename" onClick={() => (setRenaming(d.id), setAdding(false), setDraft(d.name))} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground">
                  <Pencil className="size-3" />
                </button>
                <button title="Delete deck (words are kept)" onClick={() => onDeleteDeck(d)} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive">
                  <Trash2 className="size-3" />
                </button>
              </>
            }
          />
        )
      )}
      {adding && deckInput}
      {!decks.length && !adding && (
        <button onClick={() => setAdding(true)} className="px-2 py-1 text-left text-[12px] text-muted-foreground hover:text-foreground">
          + Create a deck, e.g. “Phrasal verbs”
        </button>
      )}
      {decks.length > 0 && counts.noDeck > 0 && (
        <NavItem dot="hsl(var(--muted-foreground) / 0.4)" label="No deck" count={counts.noDeck} active={active === 'deck:none'} onClick={() => onScope({ kind: 'deck', id: 'none' })} />
      )}

      <Heading>Topics</Heading>
      {counts.topics.map(([name, n]) => (
        <NavItem key={name} icon={Hash} label={name} count={n} active={active === `topic:${name}`} onClick={() => onScope({ kind: 'topic', name })} />
      ))}
      {counts.untopiced > 0 && (
        <button
          disabled={grouping}
          onClick={onAutoGroup}
          className="mx-1 mt-1 flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary" />
          {grouping ? 'Grouping…' : `Auto-group ${counts.untopiced} ${counts.untopiced === 1 ? 'word' : 'words'} with AI`}
        </button>
      )}

      {counts.tags.length > 0 && (
        <>
          <Heading>Tags</Heading>
          {counts.tags.map(([name, n]) => (
            <NavItem key={name} icon={PencilLine} label={name} count={n} active={active === `tag:${name}`} onClick={() => onScope({ kind: 'tag', name })} />
          ))}
        </>
      )}

      <Heading
        action={
          <span className="flex items-center gap-0.5">
            <button title="Re-read files" onClick={onRescan} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <RefreshCw className="size-3.5" />
            </button>
            <button title="Open the vocabulary folder" onClick={() => void window.api.content.openFolder('vocabulary')} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <FolderOpen className="size-3.5" />
            </button>
          </span>
        }
      >
        Files
      </Heading>
      {counts.files.map(([ref, n]) => (
        <NavItem key={ref} icon={FileText} label={ref.replace(/\.md$/i, '')} count={n} active={active === `file:${ref}`} onClick={() => onScope({ kind: 'file', ref })} />
      ))}
      {!counts.files.length && (
        <button onClick={() => void window.api.content.openFolder('vocabulary')} className="px-2 py-1 text-left text-[12px] leading-snug text-muted-foreground hover:text-foreground">
          Add words with Markdown files in <span className="font-mono">vocabulary/</span> — see VOCAB_FORMAT.md
        </button>
      )}

      <Heading>Sources</Heading>
      {(['note', 'test', 'file', 'other'] as const).map((id) =>
        counts.sources[id] ? (
          <NavItem
            key={id}
            icon={id === 'note' ? BookOpen : id === 'test' ? ListChecks : id === 'file' ? FileText : Pencil}
            label={SOURCE_LABELS[id]}
            count={counts.sources[id]}
            active={active === `source:${id}`}
            onClick={() => onScope({ kind: 'source', id })}
          />
        ) : null
      )}
    </nav>
  )
}
