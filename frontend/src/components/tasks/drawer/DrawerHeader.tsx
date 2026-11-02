import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SheetClose } from '@/components/ui/sheet'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { useUpdateTask } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import { formatLocalDateTime, formatRelativeDate, getLocalToday, isoToLocalDateStr } from '@/utils/date'
import type { Task } from '@/types/models'

interface DrawerHeaderProps {
  taskId: number
  task: Task | undefined
  isLoading: boolean
  /** The shell owns the "reset subtasks?" question, so it decides what completing means */
  onToggleComplete: () => void
}

/** Completion checkbox, the inline-editable title, when it was completed, and the close button. */
export function DrawerHeader({ taskId, task, isLoading, onToggleComplete }: DrawerHeaderProps) {
  const updateTask = useUpdateTask(taskId)

  // Inline edit for title
  const titleEdit = useInlineEdit({
    initialValue: task?.title ?? '',
    onSave: (value) => updateTask.mutate({ title: value }),
    validate: (v) => (v.trim() === '' ? 'Title is required' : undefined),
  })

  // Keep inline edit value in sync when remote task loads/changes
  useEffect(() => {
    if (task && !titleEdit.isEditing) {
      // reset value to latest from server when not editing
      titleEdit.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.title])

  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border shrink-0">
      {/* Completion checkbox */}
      <input
        type="checkbox"
        checked={task?.is_complete ?? false}
        onChange={onToggleComplete}
        aria-label={task ? `Mark complete: ${task.title}` : 'Mark complete'}
        className="mt-1 h-4 w-4 rounded shrink-0 cursor-pointer accent-[var(--accent)]"
        disabled={isLoading}
      />

      {/* Inline-editable title */}
      <div className="flex-1 min-w-0">
        {titleEdit.isEditing ? (
          <input
            ref={titleEdit.inputRef as React.RefObject<HTMLInputElement>}
            value={titleEdit.value}
            onChange={(e) => titleEdit.setValue(e.target.value)}
            onKeyDown={titleEdit.handleKeyDown}
            onBlur={titleEdit.save}
            autoFocus
            className={cn(
              'w-full text-base font-semibold text-text bg-transparent',
              'border-b border-accent outline-none',
              'py-0.5'
            )}
            aria-label="Edit task title"
          />
        ) : (
          <button
            type="button"
            onClick={titleEdit.startEdit}
            className={cn(
              'w-full text-left text-base font-semibold',
              task?.is_complete ? 'text-muted line-through' : 'text-text',
              'hover:text-accent-text transition-colors'
            )}
          >
            {isLoading ? (
              <span className="block h-5 w-48 bg-surface-2 rounded animate-pulse" />
            ) : (
              task?.title ?? ''
            )}
          </button>
        )}
        {titleEdit.error && (
          <p className="mt-1 text-xs text-danger-fg" role="alert">{titleEdit.error}</p>
        )}
        {task?.is_complete && task.completed_at && (
          <p className="mt-0.5 text-xs text-muted">
            Completed{' '}
            <time
              dateTime={task.completed_at}
              title={formatLocalDateTime(task.completed_at)}
              className="underline decoration-dotted underline-offset-2"
            >
              {formatRelativeDate(isoToLocalDateStr(task.completed_at), getLocalToday()).toLowerCase()}
            </time>
          </p>
        )}
      </div>

      {/* Close button */}
      <SheetClose asChild>
        <button
          type="button"
          aria-label="Close task details"
          className="shrink-0 text-muted hover:text-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-control"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </SheetClose>
    </div>
  )
}
