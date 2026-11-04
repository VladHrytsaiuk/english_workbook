import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className
}: {
  icon: LucideIcon
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-muted/50 shadow-sm">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
