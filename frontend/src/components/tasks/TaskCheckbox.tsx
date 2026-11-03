import { cn } from '@/lib/utils'

interface TaskCheckboxProps {
  checked: boolean
  onChange: () => void
  'aria-label': string
  className?: string
}

/** A real checkbox (keyboard and screen readers) drawn as an accent box whose check mark draws itself. */
export function TaskCheckbox({ checked, onChange, 'aria-label': ariaLabel, className }: TaskCheckboxProps) {
  return (
    <span className={cn('relative inline-flex h-4 w-4 flex-shrink-0', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        className="task-check h-4 w-4 appearance-none rounded border border-border-strong bg-transparent cursor-pointer checked:bg-accent checked:border-accent"
      />
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="var(--accent-fg)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="task-check-mark pointer-events-none absolute inset-0 h-4 w-4"
      >
        <path d="M4 8.5l2.5 2.5L12 5.5" pathLength={1} />
      </svg>
    </span>
  )
}
