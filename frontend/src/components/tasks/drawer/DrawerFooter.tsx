import { Trash2 } from 'lucide-react'
import { Button, ItemLink, ItemPicker } from '@/components/common'
import { useMoveTask } from '@/hooks/useTasks'
import { useItems } from '@/hooks/useItems'
import type { Task } from '@/types/models'

function MoveToSelect({ taskId, currentItemId }: { taskId: number; currentItemId: number | null }) {
  const { data: items = [] } = useItems({ include_archived: false })
  const moveTask = useMoveTask()

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted whitespace-nowrap">Move to…</span>
      <div className="flex-1 min-w-0">
        <ItemPicker
          items={items}
          value={currentItemId}
          allowInbox
          onSelect={(itemId) => {
            if (itemId !== currentItemId) moveTask.mutate({ id: taskId, payload: { item_id: itemId } })
          }}
          placeholder="Choose…"
          ariaLabel="Move task to"
          variant="field"
          className="[&>button]:h-8 [&>button]:bg-surface"
        />
      </div>
    </div>
  )
}

interface DrawerFooterProps {
  taskId: number
  task: Task | undefined
  isLoading: boolean
  /** The shell asks for confirmation and does the deleting */
  onDelete: () => void
}

/** Where the task lives (a link to its page), Move to a project or area (or the Inbox), and Delete task. */
export function DrawerFooter({ taskId, task, isLoading, onDelete }: DrawerFooterProps) {
  return (
    <div className="shrink-0 px-5 py-3 border-t border-border space-y-2">
      {task && task.item_id !== null && (
        <p className="text-sm text-muted">
          In{' '}
          <ItemLink itemId={task.item_id} itemType={task.item_type} title={task.item_title} icon={task.item_icon} color={task.item_color} className="text-text font-medium" />
        </p>
      )}
      <MoveToSelect taskId={taskId} currentItemId={task?.item_id ?? null} />
      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
        disabled={isLoading || !task}
        aria-label="Delete task"
      >
        <Trash2 size={14} aria-hidden="true" />
        Delete task
      </Button>
    </div>
  )
}
