import React, { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Item, Task } from '@/types/models'
import { useItemTasks, useCreateTask, useCompleteTask, useIncompleteTask, useReorderTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskDrawer } from '@/components/tasks/TaskDrawer'

// Tasks section (R4.5 / R4.6 task limit): quick add, the list with drag-reorder, and the task drawer

export function TasksSection({ item, archived }: { item: Item; archived: boolean }) {
  const { data: tasks = [], isLoading: tasksLoading } = useItemTasks(item.id)
  const createTask = useCreateTask()
  const reorderTasks = useReorderTasks(item.id)
  const completeTask = useCompleteTask()
  const [newTitle, setNewTitle] = useState('')
  const incompleteTask = useIncompleteTask()
  const [searchParams, setSearchParams] = useSearchParams()

  const selectedTaskId = Number(searchParams.get('task')) || null

  // Save the element that triggered the drawer so we can restore focus on close
  const drawerTriggerRef = useRef<HTMLElement | null>(null)

  const MAX_TASKS = 100
  const atLimit = tasks.length >= MAX_TASKS

  function openDrawer(taskId: number) {
    // Save currently focused element (the task row button that was activated)
    drawerTriggerRef.current = document.activeElement as HTMLElement | null
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
    // Restore focus to the element that opened the drawer
    requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus()
      drawerTriggerRef.current = null
    })
  }

  function handleToggleComplete(task: Task) {
    if (task.is_complete) {
      incompleteTask.mutate(task.id)
    } else {
      completeTask.mutate(task.id)
    }
  }

  /** Type a title and press Enter: the task is created at once and the field stays ready for the next one. */
  function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title || atLimit || createTask.isPending) return
    createTask.mutate(
      { title, item_id: item.id, priority: 'medium' },
      { onSuccess: () => setNewTitle('') }
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
      </div>

      {!archived && (
        <form onSubmit={handleAddTask} className="mb-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={200}
            disabled={atLimit}
            placeholder={atLimit ? 'This item has reached the maximum of 100 tasks.' : 'Add a task and press Enter'}
            aria-label="Add task"
            className="w-full h-10 px-3 rounded-control border border-border-strong bg-surface text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent disabled:opacity-50"
          />
        </form>
      )}

      {tasksLoading ? (
        <p className="text-sm text-muted">Loading tasks…</p>
      ) : (
        <TaskList
          tasks={tasks}
          selectedTaskId={selectedTaskId ?? undefined}
          onOpenDrawer={openDrawer}
          onToggleComplete={handleToggleComplete}
          onReorder={archived ? undefined : (ids) => reorderTasks.mutate(ids)}
          showDeadlineStatus={!archived}
        />
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}
