import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-primary', barClassName)}
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
      />
    </div>
  )
}
