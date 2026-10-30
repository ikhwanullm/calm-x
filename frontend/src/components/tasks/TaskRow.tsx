import { GripVertical, Sun } from 'lucide-react'
import type { Task } from '@/types/models'
import { PriorityChip, TagChip, StatusBadge } from '@/components/common'
import { getDeadlineStatus } from '@/utils/deadline'
import { useDeadlineThreshold } from '@/hooks/useSettings'
import { daysSinceIso, formatAbsoluteDate, getLocalToday } from '@/utils/date'
import { cn } from '@/lib/utils'

export interface TaskRowProps {
  task: Task
  isSelected?: boolean
  /** Called when user clicks the title to open the drawer */
  onOpenDrawer: (taskId: number) => void
  /** Called when drag handle is grabbed (for dnd-kit) */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  /** Whether to show drag handle (false in inbox/list without reorder) */
  isDraggable?: boolean
  onToggleComplete: (task: Task) => void
  /** Show the due-date status badge (false for tasks of archived items, R7.8) */
  showDeadlineStatus?: boolean
  /** Show which Project/Area the task belongs to (for cross-item lists like Today) */
  showItem?: boolean
}

export function TaskRow({
  task,
  isSelected = false,
  onOpenDrawer,
  dragHandleProps,
  isDraggable = true,
  onToggleComplete,
  showDeadlineStatus = true,
  showItem = false,
}: TaskRowProps) {
  const itemLabel = showItem ? task.item_title ?? 'Inbox' : null
  const today = getLocalToday()
  const isDeferred = !!task.defer_until && task.defer_until > today && !task.is_complete
  const isParked = task.is_someday && !task.is_complete
  // How long it has been waiting, so a stale wait is easy to spot on Today
  const waitingDays = task.waiting_for && task.waiting_since ? daysSinceIso(task.waiting_since, today) : null
  const deferLabel = isDeferred && task.defer_until ? `Starts ${formatAbsoluteDate(task.defer_until)}` : null
  const threshold = useDeadlineThreshold()
  const deadlineStatus = showDeadlineStatus && task.due_date && !task.is_complete
    ? getDeadlineStatus(task.due_date, task.is_complete, threshold, today)
    : null

  return (
    <div
      className={cn(
        'flex items-center gap-2 min-h-[52px] px-3 py-2 rounded-control border border-transparent',
        'transition-colors duration-150 group',
        isSelected && 'bg-accent-soft border-accent',
        !isSelected && 'hover:bg-surface-2',
        task.is_complete && 'opacity-75',
        (isDeferred || isParked) && 'opacity-60',
      )}
    >
      {/* Drag handle */}
      {isDraggable && (
        <button
          type="button"
          aria-label={`Reorder ${task.title}`}
          className="flex-shrink-0 text-muted hover:text-text cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          {...dragHandleProps}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={task.is_complete}
        onChange={() => onToggleComplete(task)}
        aria-label={`Mark complete: ${task.title}`}
        className="flex-shrink-0 h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
      />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onOpenDrawer(task.id)}
          className={cn(
            'w-full text-left text-sm font-medium truncate',
            task.is_complete ? 'text-muted line-through' : 'text-text hover:text-accent-text',
          )}
        >
          {task.title}
        </button>

        {/* Meta line */}
        {(task.priority !== 'medium' || task.subtask_count > 0 || task.tags.length > 0 ||
          task.waiting_for || itemLabel || deferLabel || isParked) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {itemLabel && (
              <span className="text-xs text-muted truncate max-w-[16rem]">{itemLabel}</span>
            )}
            {isParked && (
              <span className="inline-flex items-center h-5 px-1.5 rounded-pill bg-surface-2 text-xs text-muted">
                Someday
              </span>
            )}
            {deferLabel && (
              <span className="inline-flex items-center h-5 px-1.5 rounded-pill bg-surface-2 text-xs text-muted">
                {deferLabel}
              </span>
            )}
            {task.waiting_for && (
              <span className="inline-flex items-center h-5 px-1.5 rounded-pill bg-surface-2 text-xs text-muted">
                Waiting · {task.waiting_for}{waitingDays !== null && waitingDays >= 1 && ` · ${waitingDays} ${waitingDays === 1 ? 'day' : 'days'}`}
              </span>
            )}
            {task.priority !== 'medium' && (
              <PriorityChip priority={task.priority} />
            )}
            {task.subtask_count > 0 && (
              <span className="text-xs text-muted tabular-nums">
                {task.completed_subtask_count}/{task.subtask_count}
              </span>
            )}
            {task.tags.map(tag => (
              <TagChip key={tag} name={tag} />
            ))}
          </div>
        )}
      </div>

      {task.focus_date && !task.is_complete && (
        <Sun size={14} className="flex-shrink-0 text-accent-text" aria-label="On Today" role="img" />
      )}

      {/* Status badge */}
      {deadlineStatus && task.due_date && (
        <div className="flex-shrink-0">
          <StatusBadge status={deadlineStatus} date={task.due_date} today={today} />
        </div>
      )}
    </div>
  )
}
