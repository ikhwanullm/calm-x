import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Plus, Trash2, Sun, CloudMoon } from 'lucide-react'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { ProgressBar, RelativeDate, ConfirmDialog, ItemPicker } from '@/components/common'
import { Button } from '@/components/common'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import {
  useTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  useIncompleteTask,
  useMoveTask,
} from '@/hooks/useTasks'
import {
  useSubtasks,
  useCreateSubtask,
  useCompleteSubtask,
  useIncompleteSubtask,
  useDeleteSubtask,
} from '@/hooks/useSubtasks'
import { useItems } from '@/hooks/useItems'
import { useTags } from '@/hooks/useTags'
import type { TaskPriority } from '@/types/models'
import { cn } from '@/lib/utils'
import { formatAbsoluteDate, formatRelativeDate, getLocalToday, isoToLocalDateStr } from '@/utils/date'

export interface TaskDrawerProps {
  taskId: number | null
  onClose: () => void
  /** Optional: called after the task is deleted so the parent can move focus */
  onDeleted?: (taskId: number) => void
}

export function TaskDrawer({ taskId, onClose, onDeleted }: TaskDrawerProps) {
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
  const addSubtaskBtnRef = useRef<HTMLButtonElement>(null)

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

  // ── Handlers ────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <SheetContent
          side="right"
          className="w-[360px] sm:w-[460px] flex flex-col p-0 bg-surface"
          aria-label="Task details"
          hideCloseButton
        >
          {/* ── Header ────────────────────────────────────────────── */}
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

          {/* ── Scrollable body ─────────────────────────────────────── */}
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

            {/* Tags */}
            {task && (
              <TagsSection taskId={safeId} currentTags={task.tags} />
            )}

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
                      onClick={() => deleteSubtask.mutate(subtask.id, {
                        onSuccess: () => {
                          requestAnimationFrame(() => addSubtaskBtnRef.current?.focus())
                        },
                      })}
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
                  ref={addSubtaskBtnRef}
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

          {/* ── Footer ────────────────────────────────────────────────── */}
          <div className="shrink-0 px-5 py-3 border-t border-border space-y-2">
            <MoveToSelect taskId={safeId} currentItemId={task?.item_id ?? null} />
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

// ── MoveToSelect ───────────────────────────────────────────────────────────────────

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

// ── TagsSection ──────────────────────────────────────────────────────────────────────

// ── WaitingForField ──────────────────────────────────────────────────────────────

function WaitingForField({
  waitingFor,
  waitingSince,
  onSave,
}: {
  waitingFor: string | null
  waitingSince: string | null
  onSave: (value: string | null) => void
}) {
  const [value, setValue] = useState(waitingFor ?? '')

  function save() {
    const next = value.trim() || null
    if (next !== waitingFor) onSave(next)
  }

  return (
    <div className="flex items-start gap-3">
      <label htmlFor="task-waiting-for" className="w-20 pt-2 text-sm text-muted shrink-0">
        Waiting for
      </label>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <input
            id="task-waiting-for"
            type="text"
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setValue(waitingFor ?? '')
            }}
            placeholder="Person, team or event"
            className={cn(
              'flex-1 min-w-0 h-9 px-3 rounded-control border border-border bg-surface text-sm text-text',
              'placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent'
            )}
          />
          {waitingFor && (
            <button
              type="button"
              onClick={() => { setValue(''); onSave(null) }}
              className="text-xs text-muted hover:text-text hover:underline shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        {waitingFor && waitingSince && (
          <p className="mt-1 text-xs text-muted">
            Waiting since {formatAbsoluteDate(isoToLocalDateStr(waitingSince))} ·{' '}
            {formatRelativeDate(isoToLocalDateStr(waitingSince))}
          </p>
        )}
      </div>
    </div>
  )
}

function TagsSection({ taskId, currentTags }: { taskId: number; currentTags: string[] }) {
  const { data: allTags = [] } = useTags()
  const updateTask = useUpdateTask(taskId)
  const [inputValue, setInputValue] = useState('')
  const MAX_TAGS = 20

  function addTag(name: string) {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return
    if (currentTags.length >= MAX_TAGS) return
    if (currentTags.includes(trimmed)) return
    // Assign updated tag list; backend creates the tag if it does not exist yet
    updateTask.mutate({ tag_names: [...currentTags, trimmed] })
    setInputValue('')
  }

  function removeTag(name: string) {
    updateTask.mutate({ tag_names: currentTags.filter((t) => t !== name) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Tags</h3>
        <span className="text-xs text-muted">{currentTags.length}/{MAX_TAGS}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {currentTags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 h-5 rounded bg-surface-2 text-xs text-text"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-muted hover:text-danger-fg"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {currentTags.length < MAX_TAGS && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(inputValue) }
            }}
            placeholder="Add tag…"
            list="available-tags"
            maxLength={50}
            aria-label="Add tag"
            className="flex-1 h-8 px-2 rounded-control border border-border bg-surface text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          />
          <datalist id="available-tags">
            {allTags
              .filter(t => !currentTags.includes(t.name))
              .map(t => <option key={t.id} value={t.name} />)}
          </datalist>
        </div>
      )}
    </div>
  )
}
