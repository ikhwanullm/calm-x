import { cn } from '@/lib/utils'
import { calculateProgress } from '@/utils/progress'

export interface ProgressBarProps {
  completed: number
  total: number
  /** Accessible label describing what is being measured */
  label: string
  className?: string
}

export function ProgressBar({ completed, total, label, className }: ProgressBarProps) {
  const pct = calculateProgress(completed, total)

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="flex-1 h-2 rounded-pill bg-track overflow-hidden"
      >
        <div
          className="h-full bg-accent rounded-pill transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-muted tabular-nums w-10 text-right shrink-0">
        {pct}%
      </span>
    </div>
  )
}
