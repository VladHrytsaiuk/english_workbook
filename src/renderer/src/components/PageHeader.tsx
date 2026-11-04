import { cn } from '@/lib/utils'

/** Top bar of a page. Doubles as the window drag region (the title bar is hidden). */
export function PageHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('drag flex min-h-[64px] items-center justify-between gap-4 border-b px-8 py-3', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="no-drag flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
