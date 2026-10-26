import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps {
  title: string
  description: string
  action?: EmptyStateAction
  /** When true, wraps in a dashed border (replacing a list) */
  dashedBorder?: boolean
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  dashedBorder = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 py-12 px-6',
        dashedBorder && 'border-2 border-dashed border-border rounded-card',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="text-sm text-muted max-w-xs">{description}</p>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
