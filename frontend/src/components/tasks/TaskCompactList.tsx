import { PriorityChip, TagChip } from '@/components/common'
import { formatRelativeDate, getLocalToday } from '@/utils/date'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/models'

const CHIP = 'inline-flex items-center h-5 px-1.5 rounded-pill bg-surface-2 text-xs text-muted whitespace-nowrap'

export interface TaskCompactListProps {
  tasks: Task[]
  label: string
  selectedTaskId: number | null
  onOpenDrawer: (taskId: number) => void
  onToggleComplete: (task: Task) => void
}

/** One row per task: checkbox, title, project, due, priority, tags and state chips. */
export function TaskCompactList({ tasks, label, selectedTaskId, onOpenDrawer, onToggleComplete }: TaskCompactListProps) {
  const today = getLocalToday()
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="text-xs font-semibold text-muted uppercase tracking-wide">
            <th scope="col" className="px-3 py-2 w-8"><span className="sr-only">Done</span></th>
            {['Title', 'Project / Area', 'Due', 'Priority', 'Tags', 'State'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const overdue = !!task.due_date && task.due_date < today && !task.is_complete
            const notStarted = !!task.defer_until && task.defer_until > today && !task.is_complete
            return (
              <tr
                key={task.id}
                className={cn('border-t border-border hover:bg-surface-2', selectedTaskId === task.id && 'bg-accent-soft')}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={task.is_complete}
                    onChange={() => onToggleComplete(task)}
                    aria-label={`Mark complete: ${task.title}`}
                    className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2 max-w-[22rem]">
                  <button
                    type="button"
                    onClick={() => onOpenDrawer(task.id)}
                    className={cn(
                      'w-full text-left text-sm font-medium truncate',
                      task.is_complete ? 'text-muted line-through' : 'text-text hover:text-accent-text'
                    )}
                  >
                    {task.title}
                  </button>
                </td>
                <td className="px-3 py-2 text-sm text-muted max-w-[12rem] truncate">{task.item_title ?? 'Inbox'}</td>
                <td className={cn('px-3 py-2 text-sm whitespace-nowrap', overdue ? 'text-danger-fg' : 'text-muted')}>
                  {task.due_date ? formatRelativeDate(task.due_date, today) : '—'}
                </td>
                <td className="px-3 py-2">{task.priority !== 'medium' && <PriorityChip priority={task.priority} />}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">{task.tags.map((t) => <TagChip key={t} name={t} />)}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {task.waiting_for && <span className={CHIP}>Waiting · {task.waiting_for}</span>}
                    {task.is_someday && !task.is_complete && <span className={CHIP}>Someday</span>}
                    {notStarted && <span className={CHIP}>Starts {formatRelativeDate(task.defer_until!, today)}</span>}
                    {task.meeting_id !== null && <span className={CHIP}>From a meeting</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
