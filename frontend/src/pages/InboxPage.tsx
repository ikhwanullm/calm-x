import { useState } from "react"
import {
  useInboxTasks,
  useCreateTask,
  useCompleteTask,
  useIncompleteTask,
  useMoveTask,
} from "@/hooks/useTasks"
import { useItems } from "@/hooks/useItems"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { EmptyState } from "@/components/common"
import { notify } from "@/lib/toast"
import type { Task } from "@/types/models"
import { cn } from "@/lib/utils"

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useInboxTasks()
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const openTasks = tasks.filter((t) => !t.is_complete)
  const completedTasks = tasks.filter((t) => t.is_complete)

  function handleToggleComplete(task: Task) {
    if (task.is_complete) incompleteTask.mutate(task.id)
    else completeTask.mutate(task.id)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-text mb-6">
        Inbox
        {openTasks.length > 0 && (
          <span className="ml-2 text-muted font-normal text-lg tabular-nums">
            {openTasks.length}
          </span>
        )}
      </h1>

      {/* Quick capture inline form */}
      <InlineCapture
        onCapture={(title) =>
          createTask.mutate(
            { title, priority: "medium" },
            {
              onSuccess: () => notify.success("Added to Inbox"),
              onError: (err: Error) => notify.error("Could not capture task.", err.message),
            }
          )
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted mt-4">Loading…</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Inbox zero."
          description="Everything has a home."
          dashedBorder
        />
      ) : (
        <div className="mt-4 space-y-1" role="list" aria-label="Inbox tasks">
          {openTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2" role="listitem">
              <div className="flex-1 min-w-0">
                <TaskRow
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onOpenDrawer={setSelectedTaskId}
                  onToggleComplete={handleToggleComplete}
                  isDraggable={false}
                />
              </div>
              <MoveToSelect task={task} />
            </div>
          ))}

          {completedTasks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="mt-3 text-sm text-muted hover:text-text transition-colors"
              >
                {showCompleted
                  ? `Hide ${completedTasks.length} completed`
                  : `Show ${completedTasks.length} completed`}
              </button>
              {showCompleted && completedTasks.map((task) => (
                <div key={task.id} role="listitem">
                  <TaskRow
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onOpenDrawer={setSelectedTaskId}
                    onToggleComplete={handleToggleComplete}
                    isDraggable={false}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}

// ---- Inline capture form ----

function InlineCapture({ onCapture }: { onCapture: (title: string) => void }) {
  const [value, setValue] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onCapture(trimmed)
    setValue("")
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Capture a task…"
        maxLength={200}
        aria-label="Capture task title"
        className={cn(
          "flex-1 h-11 px-4 rounded-control border border-border bg-surface",
          "text-sm text-text placeholder:text-muted",
          "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        )}
      />
      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Add to Inbox"
        className={cn(
          "h-11 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium",
          "hover:opacity-90 disabled:opacity-50 transition-opacity"
        )}
      >
        Add
      </button>
    </form>
  )
}

// ---- Move to... select per inbox row (task 4.3) ----

function MoveToSelect({ task }: { task: Task }) {
  const { data: items = [] } = useItems({ include_archived: false })
  const moveTask = useMoveTask()
  const destinations = items.filter((i) => i.type === "project" || i.type === "area")

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (!value) return
    const itemId = Number(value)
    moveTask.mutate(
      { id: task.id, payload: { item_id: itemId } },
      {
        onSuccess: () => notify.success("Task moved"),
        onError: (err: Error) => notify.error("Could not move task.", err.message),
      }
    )
    e.target.value = ""
  }

  if (destinations.length === 0) return null

  return (
    <select
      defaultValue=""
      onChange={handleChange}
      aria-label={`Move "${task.title}" to project or area`}
      className={cn(
        "shrink-0 h-7 px-2 text-xs rounded-control border border-border bg-surface text-muted",
        "focus:outline-2 focus:outline-offset-2 focus:outline-accent",
        "hover:text-text hover:border-accent transition-colors"
      )}
    >
      <option value="" disabled>Move to…</option>
      {destinations.map((item) => (
        <option key={item.id} value={String(item.id)}>
          {item.title}
        </option>
      ))}
    </select>
  )
}
