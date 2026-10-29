import { CardLink, ProgressBar, StatusBadge } from '@/components/common'
import { useDeadlineThreshold } from '@/hooks/useSettings'
import { getDeadlineStatus } from '@/utils/deadline'
import { formatRelativeDate } from '@/utils/date'
import { activityLabel, meetingLabel } from '@/utils/projectFacts'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/models'

const CHIP = 'inline-flex items-center h-5 px-1.5 rounded-pill text-xs'

export function NextTaskLine({ project, today }: { project: Project; today: string }) {
  const next = project.stats?.next_task
  if (!project.stats) return null
  if (!next) {
    return project.project_status === 'completed' ? null : (
      <p className="text-xs text-muted mt-2">No open tasks. Add a next step or archive it.</p>
    )
  }
  const overdue = next.due_date !== null && next.due_date < today
  return (
    <p className="text-xs text-muted mt-2 truncate">
      <span className="font-medium text-text">Next:</span> {next.title}
      {next.due_date && (
        <span className={cn(overdue && 'text-danger-fg')}> · {formatRelativeDate(next.due_date, today)}</span>
      )}
    </p>
  )
}

/** A project in the card view of the Projects page. */
export function ProjectCard({ project, today }: { project: Project; today: string }) {
  const threshold = useDeadlineThreshold()
  const completed = project.project_status === 'completed'
  const deadlineStatus = project.project_deadline
    ? getDeadlineStatus(project.project_deadline, completed, threshold, today)
    : null
  const stats = project.stats
  const activity = activityLabel(project, today)
  const meeting = meetingLabel(project, today)

  return (
    <CardLink to={`/projects/${project.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-text truncate">{project.title}</h2>
          <p className="text-xs text-muted mt-0.5 truncate">
            {project.area_title ?? 'No area'}
            {activity && (
              <span className={cn(activity.stale && 'text-warn-fg')}> · {activity.text}</span>
            )}
          </p>
        </div>
        {completed ? (
          <span className={cn(CHIP, 'bg-ok-bg text-ok-fg shrink-0')}>Completed</span>
        ) : deadlineStatus && project.project_deadline ? (
          <StatusBadge status={deadlineStatus} date={project.project_deadline} today={today} />
        ) : (
          <span className="text-xs text-muted shrink-0">No deadline</span>
        )}
      </div>

      <div className="mt-2 max-w-sm">
        <ProgressBar completed={project.completed_task_count} total={project.task_count} label={`${project.title} progress`} />
      </div>

      <NextTaskLine project={project} today={today} />

      {stats && (stats.overdue_task_count > 0 || stats.waiting_task_count > 0 || meeting || stats.linked_resource_count > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {stats.overdue_task_count > 0 && (
            <span className={cn(CHIP, 'bg-danger-bg text-danger-fg')}>{stats.overdue_task_count} overdue</span>
          )}
          {stats.waiting_task_count > 0 && (
            <span className={cn(CHIP, 'bg-surface-2 text-muted')}>{stats.waiting_task_count} waiting</span>
          )}
          {meeting && <span className={cn(CHIP, 'bg-accent-soft text-accent-text')}>{meeting}</span>}
          {stats.linked_resource_count > 0 && (
            <span className={cn(CHIP, 'bg-surface-2 text-muted')}>
              {stats.linked_resource_count} {stats.linked_resource_count === 1 ? 'resource' : 'resources'}
            </span>
          )}
        </div>
      )}
    </CardLink>
  )
}
