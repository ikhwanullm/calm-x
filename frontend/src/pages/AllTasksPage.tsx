import React from "react"
import { useSearchParams } from "react-router-dom"
import { useFilteredTasks, type FilterParams } from "@/hooks/useFilterTasks"
import { useCompleteTask, useIncompleteTask } from "@/hooks/useTasks"
import { useDeadlineThreshold } from "@/hooks/useSettings"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState, Skeleton } from "@/components/common"
import { FilterPanel } from "@/components/filters/FilterPanel"
import type { Task } from "@/types/models"

function paramsFromSearch(sp: URLSearchParams): FilterParams {
  const tagParam = sp.get("tags")
  const priParam = sp.get("priorities")
  return {
    tagIds: tagParam ? tagParam.split(",").map(Number).filter(Boolean) : undefined,
    priorities: priParam ? priParam.split(",").filter(Boolean) : undefined,
    dueStart: sp.get("due_start") ?? undefined,
    dueEnd: sp.get("due_end") ?? undefined,
    category: sp.get("category") ?? undefined,
  }
}

function paramsToSearch(f: FilterParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.tagIds?.length) sp.set("tags", f.tagIds.join(","))
  if (f.priorities?.length) sp.set("priorities", f.priorities.join(","))
  if (f.dueStart) sp.set("due_start", f.dueStart)
  if (f.dueEnd) sp.set("due_end", f.dueEnd)
  if (f.category) sp.set("category", f.category)
  return sp
}

export default function AllTasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = paramsFromSearch(searchParams)
  const selectedTaskId = searchParams.get("task") ? Number(searchParams.get("task")) : null
  const drawerTriggerRef = React.useRef<HTMLElement | null>(null)

  const { data: tasks = [], isLoading } = useFilteredTasks(filters)
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()
  useDeadlineThreshold()  // consumed by TaskRow children

  function handleChange(f: FilterParams) {
    const sp = paramsToSearch(f)
    if (selectedTaskId) sp.set("task", String(selectedTaskId))
    setSearchParams(sp)
  }

  function openDrawer(taskId: number) {
    drawerTriggerRef.current = document.activeElement as HTMLElement | null
    const sp = paramsToSearch(filters)
    sp.set("task", String(taskId))
    setSearchParams(sp)
  }

  function closeDrawer() {
    setSearchParams(paramsToSearch(filters))
    requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus()
      drawerTriggerRef.current = null
    })
  }

  function handleToggleComplete(task: Task) {
    if (task.is_complete) incompleteTask.mutate(task.id)
    else completeTask.mutate(task.id)
  }

  const openTasks = tasks.filter((t) => !t.is_complete)
  const completedTasks = tasks.filter((t) => t.is_complete)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-text mb-6 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
        All tasks
      </h1>

      <div className="mb-4">
        <FilterPanel filters={filters} onChange={handleChange} />
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No matching tasks found."
          description="Try adjusting or clearing the filters."
          dashedBorder
        />
      ) : (
        <div className="mt-4 space-y-1" role="list" aria-label="Filtered tasks">
          {openTasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskRow
                task={task}
                isSelected={selectedTaskId === task.id}
                onOpenDrawer={openDrawer}
                onToggleComplete={handleToggleComplete}
                isDraggable={false}
              />
            </div>
          ))}
          {completedTasks.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">
                Completed ({completedTasks.length})
              </p>
              {completedTasks.map((task) => (
                <div key={task.id} role="listitem">
                  <TaskRow
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onOpenDrawer={openDrawer}
                    onToggleComplete={handleToggleComplete}
                    isDraggable={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeDrawer} />
    </div>
  )
}
