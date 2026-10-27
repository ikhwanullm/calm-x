import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { ProgressBar, RelativeDate, ConfirmDialog } from '@/components/common'
import { Button } from '@/components/common'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import {
  useTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  useIncompleteTask,
} from '@/hooks/useTasks'
import {
  useSubtasks,
  useCreateSubtask,
  useCompleteSubtask,
  useIncompleteSubtask,
  useDeleteSubtask,
} from '@/hooks/useSubtasks'
import type { TaskPriority } from '@/types/models'
import { cn } from '@/lib/utils'

export interface TaskDrawerProps {
  taskId: number | null
  onClose: () => void
}

export function TaskDrawer({ taskId, onClose }: TaskDrawerProps) {
  const open = taskId !== null && taskId > 0
  const safeId = taskId ?? 0

  // Remote data
  const { data: task, isLoading } = useTask(safeId)
  const { data: subtasks = [] } = useSubtasks(safeId)

  // Mutations
  const updateTask = useUpdateTask(safeId)
  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()
  const createSubtask = useCreateSubtask(safeId)
  const completeSubtask = useCompleteSubtask(safeId)
  const incompleteSubtask = useIncompleteSubtask(safeId)
  const deleteSubtask = useDeleteSubtask(safeId)

  // Dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetSubtasksDialog, setShowResetSubtasksDialog] = useState(false)

  // Add-subtask form state
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const newSubtaskRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingSubtask) newSubtaskRef.current?.focus()
  }, [addingSubtask])

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

  // ── Handlers ─────────────────────────────────────────────────────────

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

  function handlePriorityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateTask.mutate({ priority: e.target.value as TaskPriority })
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateTask.mutate({ due_date: e.target.value || null })
  }

  function handleDescriptionBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const val = e.target.value.trim()
    if (val !== (task?.description ?? '')) {
      updateTask.mutate({ description: val })
    }
  }

  function handleAddSubtask() {
    const title = newSubtaskTitle.trim()
    if (!title) return
    createSubtask.mutate({ title })
    setNewSubtaskTitle('')
    setAddingSubtask(false)
  }

  function handleDeleteTask() {
    deleteTask.mutate(safeId)
    setShowDeleteDialog(false)
    onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <SheetContent
          side="right"
          className="w-[360px] sm:w-[460px] flex flex-col p-0 bg-surface"
          aria-label="Task details"
          hideCloseButton
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-start gap-3 px-5 py-4 border-b border-border shrink-0">
            {/* Completion checkbox */}
            <input
              type="checkbox"
              checked={task?.is_complete ?? false}
              onChange={handleToggleComplete}
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

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Priority & Due date */}
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
            </div>

            {/* Subtasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Subtasks</h3>
                {subtasks.length > 0 && (
                  <span className="text-xs text-muted tabular-nums">
                    {subtasks.filter(s => s.is_complete).length}/{subtasks.length}
                  </span>
                )}
              </div>

              {subtasks.length > 0 && (
                <ProgressBar
                  completed={subtasks.filter(s => s.is_complete).length}
                  total={subtasks.length}
                  label={`Subtask progress: ${subtasks.filter(s => s.is_complete).length} of ${subtasks.length} complete`}
                />
              )}

              {/* Subtask list */}
              <ul className="space-y-1" aria-label="Subtasks">
                {subtasks.map((subtask) => (
                  <li key={subtask.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={subtask.is_complete}
                      onChange={() => {
                        if (subtask.is_complete) {
                          incompleteSubtask.mutate(subtask.id)
                        } else {
                          completeSubtask.mutate(subtask.id)
                        }
                      }}
                      aria-label={`Mark subtask complete: ${subtask.title}`}
                      className="h-4 w-4 rounded shrink-0 cursor-pointer accent-[var(--accent)]"
                    />
                    <span className={cn(
                      'flex-1 text-sm',
                      subtask.is_complete ? 'text-muted line-through' : 'text-text'
                    )}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete subtask: ${subtask.title}`}
                      onClick={() => deleteSubtask.mutate(subtask.id)}
                      className="shrink-0 text-muted hover:text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add subtask form */}
              {addingSubtask ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAddSubtask() }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={newSubtaskRef}
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setAddingSubtask(false)
                        setNewSubtaskTitle('')
                      }
                    }}
                    placeholder="Subtask title"
                    aria-label="New subtask title"
                    className={cn(
                      'flex-1 h-8 px-3 rounded-control border border-border bg-surface text-sm text-text',
                      'focus:outline-2 focus:outline-offset-2 focus:outline-accent',
                      'placeholder:text-muted'
                    )}
                  />
                  <Button type="submit" size="sm" variant="primary" aria-label="Add subtask">
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setAddingSubtask(false); setNewSubtaskTitle('') }}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSubtask(true)}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add subtask
                </button>
              )}
            </div>

            {/* Description */}
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
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="shrink-0 px-5 py-3 border-t border-border">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isLoading || !task}
              aria-label="Delete task"
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete task
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Confirm: delete task ─────────────────────────────────────── */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete task"
        description="This task will be permanently deleted. This cannot be undone."
        confirmLabel="Delete task"
        onConfirm={handleDeleteTask}
        destructive
      />

      {/* ── Confirm: reset subtasks (R8.9) ───────────────────────────── */}
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
