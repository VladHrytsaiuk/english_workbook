import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-popover px-3.5 py-3 text-[13px] shadow-lg"
          >
            {t.variant === 'success' ? (
              <CheckCircle2 className="mt-px size-4 shrink-0 text-success" />
            ) : t.variant === 'error' ? (
              <XCircle className="mt-px size-4 shrink-0 text-destructive" />
            ) : (
              <Info className={cn('mt-px size-4 shrink-0 text-primary')} />
            )}
            <span className="leading-snug">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
