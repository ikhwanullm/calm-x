import React from "react"
import { useSearchParams } from "react-router-dom"
import { useTodayTasks, useCompleteTask, useIncompleteTask } from "@/hooks/useTasks"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState, Skeleton } from "@/components/common"
import { formatAbsoluteDate, getLocalToday } from "@/utils/date"
import type { Task } from "@/types/models"

export default function TodayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTaskId = searchParams.get("task") ? Number(searchParams.get("task")) : null
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null)
  const [showWaiting, setShowWaiting] = React.useState(true)

  const { data, isLoading, isError } = useTodayTasks()
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

  const overdue = data?.overdue ?? []
  const dueToday = data?.due_today ?? []
  const focused = data?.focused ?? []
  const waiting = data?.waiting ?? []
  const workCount = overdue.length + dueToday.length + focused.length

  function renderSection(title: string, tasks: Task[], id: string) {
    if (tasks.length === 0) return null
    return (
      <section aria-labelledby={id} className="mt-6">
        <h2 id={id} className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          {title} <span className="font-normal tabular-nums">{tasks.length}</span>
        </h2>
        <div className="space-y-1" role="list">
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
      </section>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-text tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        Today
      </h1>
      <p className="text-sm text-muted mt-1">{formatAbsoluteDate(getLocalToday())}</p>

      {isLoading ? (
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
        </div>
      ) : isError ? (
        <p className="mt-6 text-sm text-danger-fg">
          Couldn&apos;t load Today. Check that the server is running and try again.
        </p>
      ) : (
        <>
          {workCount === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Nothing planned for today."
                description="Open any task and choose Add to Today. Overdue and due-today tasks appear here on their own."
                dashedBorder
              />
            </div>
          ) : (
            <>
              {renderSection("Overdue", overdue, "today-overdue")}
              {renderSection("Due today", dueToday, "today-due")}
              {renderSection("Planned for today", focused, "today-focused")}
            </>
          )}

          {waiting.length > 0 && (
            <section aria-labelledby="today-waiting" className="mt-8 border-t border-border pt-4">
              <button
                type="button"
                id="today-waiting"
                aria-expanded={showWaiting}
                onClick={() => setShowWaiting((v) => !v)}
                className="text-xs font-semibold text-muted uppercase tracking-wide hover:text-text"
              >
                Waiting for <span className="font-normal tabular-nums">{waiting.length}</span>
              </button>
              {showWaiting && (
                <div className="space-y-1 mt-2" role="list">
                  {waiting.map((task) => (
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
            </section>
          )}
        </>
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}
