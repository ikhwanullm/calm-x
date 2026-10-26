import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface KbdProps extends HTMLAttributes<HTMLElement> {}

/**
 * Keyboard shortcut hint element.
 * Renders a <kbd> with a small bordered style per ui-guidelines §5.
 */
export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'px-1.5 h-5 min-w-5',
        'rounded border border-border',
        'bg-surface-2 text-muted',
        'text-xs font-medium leading-none',
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}
