import { Link, useNavigate } from 'react-router-dom'
import { CardLink } from '@/components/common'
import { NextTaskLine } from '@/components/projects/ProjectCard'
import { daysSinceIso, formatRelativeDate, isoToLocalDateStr } from '@/utils/date'
import { STALE_DAYS } from '@/utils/projectList'
import { cn } from '@/lib/utils'
import type { Area } from '@/types/models'

const CHIP = 'inline-flex items-center h-5 px-1.5 rounded-pill text-xs'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function lastActivity(area: Area, today: string): { text: string; stale: boolean } | null {
  if (!area.stats) return null
  const days = daysSinceIso(area.stats.last_activity_at, today)
  if (days >= STALE_DAYS) return { text: `no activity for ${days} days`, stale: true }
  const when = formatRelativeDate(isoToLocalDateStr(area.stats.last_activity_at), today)
  return { text: `updated ${when.charAt(0).toLowerCase()}${when.slice(1)}`, stale: false }
}

/** An Area in the card view of the Areas page. */
export function AreaCard({ area, today }: { area: Area; today: string }) {
  const stats = area.stats
  const activity = lastActivity(area, today)
  return (
    <CardLink to={`/areas/${area.id}`}>
      <h2 className="text-sm font-semibold text-text truncate">{area.title}</h2>
      {area.description && <p className="text-xs text-muted mt-0.5 line-clamp-1">{area.description}</p>}
      {stats && (
        <p className="text-xs text-muted mt-1">
          {plural(stats.project_count, 'project', 'projects')} · {plural(stats.open_task_count, 'open task', 'open tasks')}
          {activity && <span className={cn(activity.stale && 'text-warn-fg')}> · {activity.text}</span>}
        </p>
      )}
      {stats && (
        <>
          <NextTaskLine stats={stats} hintWhenEmpty={false} today={today} />
          {(stats.overdue_task_count > 0 || stats.waiting_task_count > 0 || stats.linked_resource_count > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {stats.overdue_task_count > 0 && (
                <span className={cn(CHIP, 'bg-danger-bg text-danger-fg')}>{stats.overdue_task_count} overdue</span>
              )}
              {stats.waiting_task_count > 0 && (
                <span className={cn(CHIP, 'bg-surface-2 text-muted')}>{stats.waiting_task_count} waiting</span>
              )}
              {stats.linked_resource_count > 0 && (
                <span className={cn(CHIP, 'bg-surface-2 text-muted')}>{plural(stats.linked_resource_count, 'resource', 'resources')}</span>
              )}
            </div>
          )}
        </>
      )}
    </CardLink>
  )
}

/** One row per Area (compact view). */
export function AreaList({ areas, today }: { areas: Area[]; today: string }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left">
        <caption className="sr-only">Areas</caption>
        <thead>
          <tr className="text-xs font-semibold text-muted uppercase tracking-wide">
            {['Title', 'Projects', 'Open tasks', 'Overdue', 'Next task', 'Last activity'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {areas.map((a) => {
            const next = a.stats?.next_task
            const activity = lastActivity(a, today)
            return (
              <tr key={a.id} onClick={() => navigate(`/areas/${a.id}`)} className="border-t border-border hover:bg-surface-2 cursor-pointer">
                <td className="px-3 py-2 max-w-[16rem]">
                  <Link to={`/areas/${a.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-text hover:underline block truncate">
                    {a.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm tabular-nums text-muted">{a.stats?.project_count ?? ''}</td>
                <td className="px-3 py-2 text-sm tabular-nums text-muted">{a.stats?.open_task_count ?? ''}</td>
                <td className="px-3 py-2 text-sm tabular-nums">
                  {a.stats && a.stats.overdue_task_count > 0
                    ? <span className="text-danger-fg">{a.stats.overdue_task_count}</span>
                    : <span className="text-muted">{a.stats ? 0 : ''}</span>}
                </td>
                <td className="px-3 py-2 text-sm text-muted max-w-[16rem] truncate">
                  {next ? (
                    <>
                      {next.title}
                      {next.due_date && (
                        <span className={cn(next.due_date < today && 'text-danger-fg')}> · {formatRelativeDate(next.due_date, today)}</span>
                      )}
                    </>
                  ) : a.stats ? '—' : ''}
                </td>
                <td className={cn('px-3 py-2 text-sm whitespace-nowrap', activity?.stale ? 'text-warn-fg' : 'text-muted')}>{activity?.text ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
