import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isProject, isArea, isArchived } from '@/types/models'
import type { Item, Task } from '@/types/models'
import {
  useItem,
  useUpdateItem,
  useCompleteProject,
  useReopenProject,
  useArchiveItem,
  useRestoreItem,
  useDeleteItem,
} from '@/hooks/useItems'
import { useItemTasks, useCreateTask, useCompleteTask, useIncompleteTask } from '@/hooks/useTasks'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import { ProgressBar, StatusBadge, Skeleton, SkeletonGroup, ConfirmDialog } from '@/components/common'
import { getDeadlineStatus } from '@/utils/deadline'
import { useDeadlineThreshold } from '@/hooks/useSettings'
import { getLocalToday, formatAbsoluteDate } from '@/utils/date'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'

interface ItemDetailViewProps {
  id: number
  /** Base path for breadcrumb link e.g. "/projects" */
  listPath: string
  listLabel: string
}

export function ItemDetailView({ id, listPath, listLabel }: ItemDetailViewProps) {
  const { data: item, isLoading, isError } = useItem(id)
  const threshold = useDeadlineThreshold()
  const updateItem = useUpdateItem(id)
  const completeProject = useCompleteProject()
  const reopenProject = useReopenProject()
  const archiveItem = useArchiveItem()
  const restoreItem = useRestoreItem()
  const deleteItem = useDeleteItem()
  const navigate = useNavigate()
  const today = getLocalToday()

  const [showArchivePrompt, setShowArchivePrompt] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (isLoading) {
    return (
      <SkeletonGroup label="Loading item details">
        <Skeleton className="w-48 h-6 mb-4" delay={0} />
        <Skeleton className="w-full h-8 mb-2" delay={0} />
        <Skeleton className="w-3/4 h-4" delay={0} />
      </SkeletonGroup>
    )
  }

  if (isError || !item) {
    return (
      <p className="text-sm text-danger-fg">
        Couldn&apos;t load item. Check the server is running and try again.
      </p>
    )
  }

  const archived = isArchived(item)

  // R1.6: Complete project -> prompt to archive
  const handleCompleteProject = () => {
    completeProject.mutate(item.id, {
      onSuccess: () => setShowArchivePrompt(true),
    })
  }

  const handleArchiveConfirm = () => {
    archiveItem.mutate(item.id, {
      onSuccess: () => navigate(listPath),
    })
  }

  const handleDeleteConfirm = () => {
    deleteItem.mutate(item.id, {
      onSuccess: () => navigate(listPath),
    })
  }

  // Ready-for-completion condition (R4.7)
  const isReadyForCompletion =
    isProject(item) &&
    item.task_count > 0 &&
    item.completed_task_count === item.task_count &&
    item.project_status === 'active' &&
    !archived

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm text-muted">
          <li><Link to={listPath} className="hover:text-accent-text">{listLabel}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-text font-medium" aria-current="page">{item.title}</li>
        </ol>
      </nav>

      {/* 2.17: Full archive banner */}
      {archived && (
        <div
          className="mb-4 px-4 py-3 rounded-control border border-warn-fg bg-warn-bg text-sm flex items-center justify-between gap-4"
          role="status"
        >
          <span className="text-warn-fg font-medium">
            Read-only · Archived on {formatAbsoluteDate(item.archived_at!)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => restoreItem.mutate(item.id)}
              className="text-sm font-medium text-warn-fg hover:underline"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-danger-fg hover:underline"
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}

      {/* 2.14: Ready-for-completion banner */}
      {isReadyForCompletion && (
        <div className="mb-4 px-4 py-3 rounded-control border border-ok-fg bg-ok-bg text-ok-fg text-sm flex items-center justify-between">
          <span>All tasks done. Ready to complete this project.</span>
          <button
            type="button"
            onClick={handleCompleteProject}
            className="text-sm font-medium underline hover:no-underline"
          >
            Complete project
          </button>
        </div>
      )}

      {/* Header row: title + 2.16 actions menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title - inline edit */}
          <InlineTitle
            item={item}
            disabled={archived}
            onSave={(title) => updateItem.mutate({ title })}
          />

          {/* 2.15: Mark complete / Reopen actions */}
          {isProject(item) && !archived && item.project_status === 'active' && (
            <button
              type="button"
              onClick={handleCompleteProject}
              className="mt-3 text-sm text-accent-text hover:underline"
            >
              Mark project complete
            </button>
          )}
          {isProject(item) && !archived && item.project_status === 'completed' && (
            <button
              type="button"
              onClick={() => reopenProject.mutate(item.id)}
              className="mt-3 text-sm text-muted hover:text-accent-text hover:underline"
            >
              Reopen project
            </button>
          )}
        </div>

        {/* 2.16: Item actions menu (...) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Item actions"
              className="flex-shrink-0 mt-1 p-1.5 rounded-control text-muted hover:text-text hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              <span aria-hidden="true" className="text-base leading-none tracking-widest">···</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {archived ? (
              <>
                <DropdownMenuItem onSelect={() => restoreItem.mutate(item.id)}>
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteConfirm(true)}
                  className="text-danger-fg focus:text-danger-fg"
                >
                  Delete permanently
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    archiveItem.mutate(item.id, { onSuccess: () => navigate(listPath) })
                  }}
                >
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteConfirm(true)}
                  className="text-danger-fg focus:text-danger-fg"
                >
                  Delete {item.type}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Project deadline status */}
      {isProject(item) && item.project_deadline && (
        <div className="mt-2">
          {getDeadlineStatus(item.project_deadline, item.project_status === 'completed', threshold, today) && (
            <StatusBadge
              status={getDeadlineStatus(item.project_deadline, item.project_status === 'completed', threshold, today)!}
              date={item.project_deadline}
              today={today}
            />
          )}
        </div>
      )}

      {/* Project goal */}
      {isProject(item) && (
        <InlineField
          label="Goal"
          value={item.project_goal ?? ''}
          placeholder="What does success look like?"
          disabled={archived}
          onSave={(v) => updateItem.mutate({ project_goal: v || null })}
        />
      )}

      {/* Project progress */}
      {isProject(item) && item.task_count > 0 && (
        <div className="mt-4">
          <ProgressBar
            completed={item.completed_task_count}
            total={item.task_count}
            label={`${item.title} progress`}
          />
        </div>
      )}

      {/* Area maintenance notes */}
      {isArea(item) && (
        <InlineField
          label="Maintenance notes"
          value={item.area_maintenance_notes ?? ''}
          placeholder="Notes on how to maintain this area…"
          multiline
          disabled={archived}
          onSave={(v) => updateItem.mutate({ area_maintenance_notes: v || null })}
        />
      )}

      {/* Description */}
      <InlineField
        label="Description"
        value={item.description}
        placeholder="Add a description…"
        multiline
        disabled={archived}
        onSave={(v) => updateItem.mutate({ description: v })}
      />

      {/* Notes */}
      <InlineField
        label="Notes"
        value={item.notes}
        placeholder="Add notes…"
        multiline
        disabled={archived}
        onSave={(v) => updateItem.mutate({ notes: v })}
      />

      {/* Tasks section */}
      <TasksSection item={item} archived={archived} />

      {/* 2.15: Archive prompt after completing project (R1.6) */}
      <ConfirmDialog
        open={showArchivePrompt}
        onOpenChange={setShowArchivePrompt}
        title="Archive this project?"
        description="The project has been marked complete. Would you like to archive it now?"
        confirmLabel="Archive"
        cancelLabel="Keep active"
        destructive={false}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setShowArchivePrompt(false)}
      />

      {/* 2.16: Delete confirm dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}?`}
        description={`This will permanently delete "${item.title}" and all its tasks. This cannot be undone.`}
        confirmLabel={`Delete ${item.type}`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tasks section (R4.5 / R4.6 task limit)
// ---------------------------------------------------------------------------

function TasksSection({ item, archived }: { item: Item; archived: boolean }) {
  const { data: tasks = [], isLoading: tasksLoading } = useItemTasks(item.id)
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedTaskId = Number(searchParams.get('task')) || null

  const MAX_TASKS = 100
  const atLimit = tasks.length >= MAX_TASKS

  function openDrawer(taskId: number) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('task', String(taskId))
      return next
    })
  }

  function closeDrawer() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('task')
      return next
    })
  }

  function handleToggleComplete(task: Task) {
    if (task.is_complete) {
      incompleteTask.mutate(task.id)
    } else {
      completeTask.mutate(task.id)
    }
  }

  function handleAddTask() {
    createTask.mutate(
      { title: 'New task', item_id: item.id, priority: 'medium' },
      { onSuccess: (newTask) => openDrawer(newTask.id) }
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">
          Tasks
          {tasks.length > 0 && (
            <span className="ml-2 text-muted font-normal">{tasks.length}</span>
          )}
        </h3>
        {!archived && (
          <button
            type="button"
            onClick={handleAddTask}
            disabled={atLimit}
            title={atLimit ? 'This item has reached the maximum of 100 tasks.' : undefined}
            aria-label="Add task"
            className="text-sm text-accent-text hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          >
            + Add task
          </button>
        )}
      </div>

      {tasksLoading ? (
        <p className="text-sm text-muted">Loading tasks…</p>
      ) : (
        <TaskList
          tasks={tasks}
          selectedTaskId={selectedTaskId ?? undefined}
          onOpenDrawer={openDrawer}
          onToggleComplete={handleToggleComplete}
        />
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline title editor
// ---------------------------------------------------------------------------

function InlineTitle({
  item,
  disabled,
  onSave,
}: {
  item: Item
  disabled: boolean
  onSave: (title: string) => void
}) {
  const edit = useInlineEdit({
    initialValue: item.title,
    onSave,
    validate: (v) => {
      if (!v.trim()) return 'Title is required'
      if (v.length > 200) return 'Title must be 200 characters or less'
    },
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (edit.isEditing) inputRef.current?.focus()
  }, [edit.isEditing])

  if (edit.isEditing) {
    return (
      <div>
        <input
          ref={inputRef}
          type="text"
          value={edit.value}
          onChange={(e) => edit.setValue(e.target.value)}
          onKeyDown={edit.handleKeyDown}
          onBlur={edit.save}
          maxLength={200}
          aria-label="Item title"
          aria-invalid={!!edit.error}
          className={cn(
            'w-full text-2xl font-semibold bg-transparent border-b-2 focus:outline-none',
            edit.error ? 'border-danger-fg' : 'border-accent'
          )}
        />
        {edit.error && <p className="mt-1 text-xs text-danger-fg">{edit.error}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : edit.startEdit}
      disabled={disabled}
      aria-label={`Edit title: ${item.title}`}
      className={cn(
        'text-left text-2xl font-semibold text-text',
        !disabled && 'hover:text-accent-text cursor-text'
      )}
    >
      {item.title}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Generic inline text field
// ---------------------------------------------------------------------------

function InlineField({
  label,
  value,
  placeholder,
  disabled,
  onSave,
  multiline = false,
}: {
  label: string
  value: string
  placeholder: string
  disabled: boolean
  onSave: (v: string) => void
  multiline?: boolean
}) {
  const edit = useInlineEdit({ initialValue: value, onSave })
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (edit.isEditing) (inputRef.current as HTMLElement | null)?.focus()
  }, [edit.isEditing])

  const sharedProps = {
    value: edit.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      edit.setValue(e.target.value),
    onKeyDown: edit.handleKeyDown,
    onBlur: edit.save,
    'aria-label': label,
    className:
      'w-full bg-transparent border-b border-border focus:border-accent focus:outline-none text-sm text-text resize-none',
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{label}</p>
      {edit.isEditing ? (
        multiline ? (
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            rows={3}
            {...sharedProps}
          />
        ) : (
          <input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            {...sharedProps}
          />
        )
      ) : (
        <button
          type="button"
          onClick={disabled ? undefined : edit.startEdit}
          disabled={disabled}
          className={cn(
            'w-full text-left text-sm',
            value ? 'text-text' : 'text-muted italic',
            !disabled && 'hover:text-accent-text cursor-text'
          )}
        >
          {value || placeholder}
        </button>
      )}
    </div>
  )
}
