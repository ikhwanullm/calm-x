import { cn } from '@/lib/utils'

export type Priority = 'high' | 'medium' | 'low'

export interface PriorityChipProps {
  priority: Priority
  className?: string
}

const labels: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function PriorityChip({ priority, className }: PriorityChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center h-5 px-2',
        'rounded-control bg-surface-2 text-text',
        'text-xs font-medium',
        className
      )}
    >
      {labels[priority]}
    </span>
  )
}
