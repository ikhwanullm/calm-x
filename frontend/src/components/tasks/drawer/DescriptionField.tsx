import { useUpdateTask } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import type { Task } from '@/types/models'

interface DescriptionFieldProps {
  taskId: number
  task: Task | undefined
  isLoading: boolean
}

/** The description text area; it saves when it loses focus and the text changed. */
export function DescriptionField({ taskId, task, isLoading }: DescriptionFieldProps) {
  const updateTask = useUpdateTask(taskId)

  function handleDescriptionBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const val = e.target.value.trim()
    if (val !== (task?.description ?? '')) {
      updateTask.mutate({ description: val })
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="task-description" className="text-sm font-semibold text-text">
        Description
      </label>
      <textarea
        id="task-description"
        key={task?.id}
        defaultValue={task?.description ?? ''}
        onBlur={handleDescriptionBlur}
        placeholder="Add a description…"
        rows={4}
        disabled={isLoading || !task}
        className={cn(
          'w-full px-3 py-2 rounded-control border border-border bg-surface text-sm text-text',
          'focus:outline-2 focus:outline-offset-2 focus:outline-accent',
          'placeholder:text-muted resize-none disabled:opacity-50'
        )}
      />
    </div>
  )
}
