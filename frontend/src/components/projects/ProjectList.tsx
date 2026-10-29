import { Link, useNavigate } from 'react-router-dom'
import { ProgressBar, StatusBadge } from '@/components/common'
import { useDeadlineThreshold } from '@/hooks/useSettings'
import { getDeadlineStatus } from '@/utils/deadline'
import { formatRelativeDate } from '@/utils/date'
import { activityLabel } from '@/utils/projectFacts'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/models'

function Row({ project, today }: { project: Project; today: string }) {
  const navigate = useNavigate()
  const threshold = useDeadlineThreshold()
  const completed = project.project_status === 'completed'
  const deadlineStatus = project.project_deadline
    ? getDeadlineStatus(project.project_deadline, completed, threshold, today)
    : null
  const next = project.stats?.next_task
  const activity = activityLabel(project, today)

  return (
    <tr
      onClick={() => navigate(`/projects/${project.id}`)}
      className="border-t border-border hover:bg-surface-2 cursor-pointer"
    >
      <td className="px-3 py-2 max-w-[16rem]">
        <Link
          to={`/projects/${project.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-text hover:underline block truncate"
        >
          {project.title}
        </Link>
      </td>
      <td className="px-3 py-2 text-sm text-muted max-w-[10rem] truncate">{project.area_title ?? '—'}</td>
      <td className="px-3 py-2 w-44">
        <ProgressBar completed={project.completed_task_count} total={project.task_count} label={`${project.title} progress`} />
      </td>
      <td className="px-3 py-2 text-sm text-muted max-w-[16rem] truncate">
        {next ? (
          <>
            {next.title}
            {next.due_date && (
              <span className={cn(next.due_date < today && 'text-danger-fg')}> · {formatRelativeDate(next.due_date, today)}</span>
            )}
          </>
        ) : project.stats ? '—' : ''}
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        {completed ? (
          <span className="text-ok-fg">Completed</span>
        ) : deadlineStatus && project.project_deadline ? (
          <StatusBadge status={deadlineStatus} date={project.project_deadline} today={today} />
        ) : (
          <span className="text-muted">No deadline</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm tabular-nums">
        {project.stats && project.stats.overdue_task_count > 0
          ? <span className="text-danger-fg">{project.stats.overdue_task_count}</span>
          : <span className="text-muted">0</span>}
      </td>
      <td className={cn('px-3 py-2 text-sm whitespace-nowrap', activity?.stale ? 'text-warn-fg' : 'text-muted')}>
        {activity?.text ?? ''}
      </td>
    </tr>
  )
}

/** One row per project (compact view of the Projects page). */
export function ProjectList({ projects, today }: { projects: Project[]; today: string }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left">
        <caption className="sr-only">Projects</caption>
        <thead>
          <tr className="text-xs font-semibold text-muted uppercase tracking-wide">
            {['Title', 'Area', 'Progress', 'Next task', 'Deadline', 'Overdue', 'Last activity'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => <Row key={p.id} project={p} today={today} />)}
        </tbody>
      </table>
    </div>
  )
}
