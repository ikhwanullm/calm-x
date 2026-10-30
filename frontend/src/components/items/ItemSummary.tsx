import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/utils/date'
import { meetingLabelFromStats } from '@/utils/projectFacts'
import type { ProjectStats } from '@/types/models'

function Tile({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'danger' }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</dt>
      <dd className={cn('mt-0.5 text-sm text-text truncate', tone === 'danger' && 'text-danger-fg font-medium')}>{children}</dd>
    </div>
  )
}

/**
 * Numbers at the top of a Project or Area page: open, overdue and waiting tasks, the next task
 * (opens its drawer), the next or last meeting and, for an Area, how many projects it has.
 */
export function ItemSummary({ stats, isArea, today }: { stats: ProjectStats; isArea: boolean; today: string }) {
  const next = stats.next_task
  const meeting = meetingLabelFromStats(stats, today)
  return (
    <dl aria-label="Summary" className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 rounded-card border border-border bg-surface px-4 py-3">
      {isArea && <Tile label="Projects">{stats.project_count}</Tile>}
      <Tile label="Open tasks">{stats.open_task_count}</Tile>
      <Tile label="Overdue" tone={stats.overdue_task_count > 0 ? 'danger' : undefined}>{stats.overdue_task_count}</Tile>
      {stats.waiting_task_count > 0 && <Tile label="Waiting">{stats.waiting_task_count}</Tile>}
      <Tile label="Next task">
        {next ? (
          <Link to={`?task=${next.id}`} className="hover:text-accent-text hover:underline" title={next.title}>
            {next.title}
            {next.due_date && (
              <span className={cn('text-muted', next.due_date < today && 'text-danger-fg')}> · {formatRelativeDate(next.due_date, today)}</span>
            )}
          </Link>
        ) : (
          <span className="text-muted">None</span>
        )}
      </Tile>
      {meeting && <Tile label="Meetings">{meeting}</Tile>}
    </dl>
  )
}
