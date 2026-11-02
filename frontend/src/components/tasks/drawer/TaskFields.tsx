import { Link } from 'react-router-dom'
import { CloudMoon, Sun } from 'lucide-react'
import { RelativeDate } from '@/components/common'
import { useUpdateTask } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import { formatAbsoluteDate, getLocalToday, isoToLocalDateStr } from '@/utils/date'
import type { Task, TaskPriority } from '@/types/models'
import { WaitingForField } from './WaitingForField'

interface TaskFieldsProps {
  taskId: number
  task: Task | undefined
  isLoading: boolean
}

/** Priority, due date, Today, Defer until, Someday, the meeting it came from, and Waiting for. */
export function TaskFields({ taskId, task, isLoading }: TaskFieldsProps) {
  const updateTask = useUpdateTask(taskId)

  function handlePriorityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateTask.mutate({ priority: e.target.value as TaskPriority })
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateTask.mutate({ due_date: e.target.value || null })
  }

  return (
    <div className="space-y-3">
      {/* Priority */}
      <div className="flex items-center gap-3">
        <label htmlFor="task-priority" className="w-20 text-sm text-muted shrink-0">
          Priority
        </label>
        <select
          id="task-priority"
          value={task?.priority ?? 'medium'}
          onChange={handlePriorityChange}
          disabled={isLoading || !task}
          className={cn(
            'flex-1 h-9 px-3 rounded-control border border-border bg-surface text-sm text-text',
            'focus:outline-2 focus:outline-offset-2 focus:outline-accent',
            'disabled:opacity-50 cursor-pointer'
          )}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Due date */}
      <div className="flex items-center gap-3">
        <label htmlFor="task-due-date" className="w-20 text-sm text-muted shrink-0">
          Due date
        </label>
        <div className="flex-1 flex items-center gap-2">
          <input
            id="task-due-date"
            type="date"
            value={task?.due_date ?? ''}
            onChange={handleDueDateChange}
            disabled={isLoading || !task}
            className={cn(
              'h-9 px-3 rounded-control border border-border bg-surface text-sm text-text',
              'focus:outline-2 focus:outline-offset-2 focus:outline-accent',
              'disabled:opacity-50'
            )}
          />
          {task?.due_date && (
            <RelativeDate date={task.due_date} inline />
          )}
        </div>
      </div>

      {/* Today */}
      <div className="flex items-center gap-3">
        <span className="w-20 text-sm text-muted shrink-0">Today</span>
        {task?.focus_date ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-accent-text">
              <Sun size={14} aria-hidden="true" />
              On Today
            </span>
            <button
              type="button"
              onClick={() => updateTask.mutate({ focus_date: null })}
              className="text-xs text-muted hover:text-text hover:underline"
            >
              Remove from Today
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => updateTask.mutate({ focus_date: getLocalToday() })}
            disabled={isLoading || !task}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-border-strong',
              'text-sm text-text hover:bg-surface-2 disabled:opacity-50',
              'focus:outline-2 focus:outline-offset-2 focus:outline-accent'
            )}
          >
            <Sun size={14} aria-hidden="true" />
            Add to Today
          </button>
        )}
      </div>

      {/* Defer until */}
      <div className="flex items-center gap-3">
        <label htmlFor="task-defer-until" className="w-20 text-sm text-muted shrink-0">
          Defer until
        </label>
        <div className="flex-1 flex items-center gap-2">
          <input
            id="task-defer-until"
            type="date"
            value={task?.defer_until ?? ''}
            max={task?.due_date ?? undefined}
            onChange={(e) => updateTask.mutate({ defer_until: e.target.value || null })}
            disabled={isLoading || !task}
            className={cn(
              'h-9 px-3 rounded-control border border-border bg-surface text-sm text-text',
              'focus:outline-2 focus:outline-offset-2 focus:outline-accent',
              'disabled:opacity-50'
            )}
          />
          {task?.defer_until && (
            <button
              type="button"
              onClick={() => updateTask.mutate({ defer_until: null })}
              className="text-xs text-muted hover:text-text hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Someday */}
      <div className="flex items-center gap-3">
        <span className="w-20 text-sm text-muted shrink-0">Someday</span>
        {task?.is_someday ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-text">
              <CloudMoon size={14} aria-hidden="true" />
              Parked for later
            </span>
            <button
              type="button"
              onClick={() => updateTask.mutate({ is_someday: false })}
              className="text-xs text-muted hover:text-text hover:underline"
            >
              Move back to active
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => updateTask.mutate({ is_someday: true })}
            disabled={isLoading || !task}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-border-strong',
              'text-sm text-text hover:bg-surface-2 disabled:opacity-50',
              'focus:outline-2 focus:outline-offset-2 focus:outline-accent'
            )}
          >
            <CloudMoon size={14} aria-hidden="true" />
            Move to Someday
          </button>
        )}
      </div>

      {/* Meeting this task came from */}
      {task?.meeting_id != null && task.meeting_title && task.meeting_held_at && (
        <div className="flex items-center gap-3">
          <span className="w-20 text-sm text-muted shrink-0">Meeting</span>
          <Link
            to={`/meetings/${task.meeting_id}`}
            className="text-sm text-accent-text hover:underline min-w-0 truncate"
          >
            From meeting: {task.meeting_title}, {formatAbsoluteDate(isoToLocalDateStr(task.meeting_held_at))}
          </Link>
        </div>
      )}

      {/* Waiting for */}
      {task && (
        <WaitingForField
          key={`${task.id}-${task.waiting_for ?? ''}`}
          waitingFor={task.waiting_for}
          waitingSince={task.waiting_since}
          onSave={(value) => updateTask.mutate({ waiting_for: value })}
        />
      )}
    </div>
  )
}
