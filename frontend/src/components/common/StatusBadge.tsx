import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RelativeDate } from './RelativeDate'
import { formatRelativeDate, formatAbsoluteDate } from '@/utils/date'

export type BadgeStatus = 'overdue' | 'approaching' | 'on-track'

export interface StatusBadgeProps {
  status: BadgeStatus
  date: string        // YYYY-MM-DD
  isComplete?: boolean
  /** Override today for testing */
  today?: string
}

const config: Record<
  BadgeStatus,
  {
    icon: typeof AlertCircle
    label: string
    ariaPrefix: string
    classes: string
  }
> = {
  overdue: {
    icon: AlertCircle,
    label: 'Overdue',
    ariaPrefix: 'overdue',
    classes: 'bg-danger-bg text-danger-fg',
  },
  approaching: {
    icon: Clock,
    label: 'Due soon',
    ariaPrefix: 'approaching deadline',
    classes: 'bg-warn-bg text-warn-fg',
  },
  'on-track': {
    icon: CheckCircle2,
    label: 'On track',
    ariaPrefix: 'on track',
    classes: 'bg-ok-bg text-ok-fg',
  },
}

export function StatusBadge({ status, date, isComplete = false, today }: StatusBadgeProps) {
  if (isComplete) return null

  const { icon: Icon, label, ariaPrefix, classes } = config[status]

  // Aria-label = prefix: relative, absolute (e.g. "approaching deadline: in 3 days, Thu, 29 Oct 2026")
  const relative = formatRelativeDate(date, today)
  const absolute = formatAbsoluteDate(date)
  const ariaLabel = `${ariaPrefix}: ${relative.charAt(0).toLowerCase()}${relative.slice(1)}, ${absolute}`

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-pill',
        'text-xs font-semibold',
        classes
      )}
    >
      <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
      <RelativeDate date={date} today={today} inline />
    </span>
  )
}
