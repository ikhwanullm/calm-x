import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RelativeDate } from './RelativeDate'

export type BadgeStatus = 'overdue' | 'approaching' | 'on-track'

export interface StatusBadgeProps {
  status: BadgeStatus
  date: string        // YYYY-MM-DD
  isComplete?: boolean
}

const config: Record<
  BadgeStatus,
  {
    icon: typeof AlertCircle
    label: string
    ariaLabel: string
    classes: string
  }
> = {
  overdue: {
    icon: AlertCircle,
    label: 'Overdue',
    ariaLabel: 'overdue',
    classes: 'bg-danger-bg text-danger-fg',
  },
  approaching: {
    icon: Clock,
    label: 'Due soon',
    ariaLabel: 'approaching deadline',
    classes: 'bg-warn-bg text-warn-fg',
  },
  'on-track': {
    icon: CheckCircle2,
    label: 'On track',
    ariaLabel: 'on track',
    classes: 'bg-ok-bg text-ok-fg',
  },
}

export function StatusBadge({ status, date, isComplete = false }: StatusBadgeProps) {
  if (isComplete) return null

  const { icon: Icon, label, ariaLabel, classes } = config[status]

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-pill',
        'text-xs font-semibold',
        classes
      )}
    >
      <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
      <RelativeDate date={date} />
    </span>
  )
}
