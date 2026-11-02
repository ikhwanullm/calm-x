import { useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/common'
import { useCompleteTask, useDeleteTask, useIncompleteTask, useTask } from '@/hooks/useTasks'
import { useSubtasks } from '@/hooks/useSubtasks'
import { DescriptionField } from './drawer/DescriptionField'
import { DrawerFooter } from './drawer/DrawerFooter'
import { DrawerHeader } from './drawer/DrawerHeader'
import { SubtasksSection } from './drawer/SubtasksSection'
import { TagsSection } from './drawer/TagsSection'
import { TaskFields } from './drawer/TaskFields'

export interface TaskDrawerProps {
  taskId: number | null
  onClose: () => void
  /** Optional: called after the task is deleted so the parent can move focus */
  onDeleted?: (taskId: number) => void
}

/**
 * The task detail drawer. This is the shell: it loads the task and its subtasks, owns the two confirmations
 * (delete, reset subtasks) and lays the pieces out. The pieces live in `./drawer/`; each gets what it shows
 * as props and calls the mutation hooks it needs itself.
 */
export function TaskDrawer({ taskId, onClose, onDeleted }: TaskDrawerProps) {
  const open = taskId !== null && taskId > 0
  const safeId = taskId ?? 0

  // Remote data
  const { data: task, isLoading } = useTask(safeId)
  const { data: subtasks = [] } = useSubtasks(safeId)

  // Mutations the shell needs for the two confirmations
  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()

  // Dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetSubtasksDialog, setShowResetSubtasksDialog] = useState(false)

  function handleToggleComplete() {
    if (!task) return
    if (task.is_complete) {
      const hasCompletedSubtasks = subtasks.some((s) => s.is_complete)
      if (hasCompletedSubtasks) {
        setShowResetSubtasksDialog(true)
      } else {
        incompleteTask.mutate(safeId)
      }
    } else {
      completeTask.mutate(safeId)
    }
  }

  function handleConfirmResetSubtasks() {
    incompleteTask.mutate(safeId)
    setShowResetSubtasksDialog(false)
  }

  function handleDeleteTask() {
    const deletedId = safeId
    deleteTask.mutate(deletedId)
    setShowDeleteDialog(false)
    onClose()
    // Move focus to the next/previous task row or the list container
    requestAnimationFrame(() => {
      if (onDeleted) {
        onDeleted(deletedId)
      } else {
        // Fallback: focus the first task row title button or the main element
        const firstTaskBtn = document.querySelector<HTMLButtonElement>(
          '[role="list"] button[class*="text-left"]'
        )
        if (firstTaskBtn) {
          firstTaskBtn.focus()
        } else {
          (document.querySelector('main') as HTMLElement | null)?.focus()
        }
      }
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <SheetContent
          side="right"
          className="w-[360px] sm:w-[460px] flex flex-col p-0 bg-surface"
          aria-label="Task details"
          hideCloseButton
        >
          <DrawerHeader taskId={safeId} task={task} isLoading={isLoading} onToggleComplete={handleToggleComplete} />

          {/* ── Scrollable body ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <TaskFields taskId={safeId} task={task} isLoading={isLoading} />

            {task && <TagsSection taskId={safeId} currentTags={task.tags} />}

            <SubtasksSection taskId={safeId} subtasks={subtasks} />

            <DescriptionField taskId={safeId} task={task} isLoading={isLoading} />
          </div>

          <DrawerFooter
            taskId={safeId}
            task={task}
            isLoading={isLoading}
            onDelete={() => setShowDeleteDialog(true)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Confirm: delete task ─────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete task"
        description="This task and its subtasks will be deleted. You can undo it from the message that appears."
        confirmLabel="Delete task"
        onConfirm={handleDeleteTask}
        destructive
      />

      {/* ── Confirm: reset subtasks (R8.9) ───────────────────────────────── */}
      <ConfirmDialog
        open={showResetSubtasksDialog}
        onOpenChange={setShowResetSubtasksDialog}
        title="Reset subtasks"
        description="Reopening this task will reset all completed subtasks to incomplete. Continue?"
        confirmLabel="Reset all subtasks"
        onConfirm={handleConfirmResetSubtasks}
        destructive={false}
      />
    </>
  )
}
