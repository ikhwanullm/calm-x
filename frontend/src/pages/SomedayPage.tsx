import React from "react"
import { useSearchParams } from "react-router-dom"
import { useSomedayTasks, useCompleteTask, useIncompleteTask } from "@/hooks/useTasks"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState, Skeleton } from "@/components/common"
import type { Task } from "@/types/models"

export default function SomedayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTaskId = searchParams.get("task") ? Number(searchParams.get("task")) : null
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null)

  const { data: tasks = [], isLoading, isError } = useSomedayTasks()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()

  function openDrawer(taskId: number) {
    drawerTriggerRef.current = document.activeElement as HTMLElement | null
    setSearchParams({ task: String(taskId) })
  }

  function closeDrawer() {
    setSearchParams({})
    requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus()
      drawerTriggerRef.current = null
    })
  }

  function handleToggleComplete(task: Task) {
    if (task.is_complete) incompleteTask.mutate(task.id)
    else completeTask.mutate(task.id)
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-text tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        Someday
        {tasks.length > 0 && (
          <span className="ml-2 text-muted font-normal text-lg tabular-nums">{tasks.length}</span>
        )}
      </h1>
      <p className="text-sm text-muted mt-1">
        Ideas you want to keep but not act on yet. They stay out of Today and your Inbox.
      </p>

      {isLoading ? (
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
        </div>
      ) : isError ? (
        <p className="mt-6 text-sm text-danger-fg">
          Couldn&apos;t load Someday. Check that the server is running and try again.
        </p>
      ) : tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing parked."
            description="Open any task and choose Move to Someday to keep an idea without it cluttering your lists."
            dashedBorder
          />
        </div>
      ) : (
        <div className="space-y-1 mt-6" role="list" aria-label="Someday tasks">
          {tasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskRow
                task={task}
                isSelected={selectedTaskId === task.id}
                onOpenDrawer={openDrawer}
                onToggleComplete={handleToggleComplete}
                isDraggable={false}
                showItem
              />
            </div>
          ))}
        </div>
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}
