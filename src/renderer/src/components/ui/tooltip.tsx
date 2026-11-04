import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children, side = 'right' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
