import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium leading-4 transition-colors', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary/12 text-primary',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-muted-foreground',
      success: 'border-transparent bg-success/12 text-success',
      destructive: 'border-transparent bg-destructive/12 text-destructive',
      warning: 'border-transparent bg-warning/15 text-warning'
    }
  },
  defaultVariants: { variant: 'default' }
})

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
