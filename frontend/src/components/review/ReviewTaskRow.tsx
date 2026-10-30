import { cn } from '@/lib/utils'

export const REVIEW_BUTTON =
  'inline-flex items-center h-9 px-3 rounded-control border border-border bg-surface text-sm font-medium text-text hover:bg-surface-2 disabled:opacity-50'

/** One task in a review step: what it is, a line of facts, and the actions; after an action only its outcome is shown. */
export function ReviewTaskRow({
  title, subtitle, badge, outcome, children,
}: {
  title: string
  subtitle: string
  badge?: React.ReactNode
  /** Set once the task has been dealt with: replaces the action buttons. */
  outcome?: string
  children?: React.ReactNode
}) {
  return (
    <li className={cn('flex flex-col gap-2 px-4 py-3 rounded-xl border border-border bg-surface', outcome && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text break-words">{title}</p>
          <p className="text-xs text-muted truncate">{subtitle}</p>
        </div>
        {badge}
      </div>
      {outcome ? (
        <p className="text-xs font-medium text-ok-fg" role="status">{outcome}</p>
      ) : (
        <div className="flex flex-wrap gap-2">{children}</div>
      )}
    </li>
  )
}
