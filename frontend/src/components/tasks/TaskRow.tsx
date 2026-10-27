import { GripVertical } from 'lucide-react'
import type { Task } from '@/types/models'
import { PriorityChip, TagChip, StatusBadge } from '@/components/common'
import { getDeadlineStatus } from '@/utils/deadline'
import { useDeadlineThreshold } from '@/hooks/useSettings'
import { getLocalToday } from '@/utils/date'
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
}

export function TaskRow({
  task,
  isSelected = false,
  onOpenDrawer,
  dragHandleProps,
  isDraggable = true,
  onToggleComplete,
}: TaskRowProps) {
  const today = getLocalToday()
  const threshold = useDeadlineThreshold()
  const deadlineStatus = task.due_date && !task.is_complete
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
      )}
      role="row"
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
        {(task.priority !== 'medium' || task.subtask_count > 0 || task.tags.length > 0) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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

      {/* Status badge */}
      {deadlineStatus && task.due_date && (
        <div className="flex-shrink-0">
          <StatusBadge status={deadlineStatus} date={task.due_date} today={today} />
        </div>
      )}
    </div>
  )
}
