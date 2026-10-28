import { useState, useEffect, useRef } from "react"
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
import type { Task, Item } from "@/types/models"
import { cn } from "@/lib/utils"

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useInboxTasks()
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const incompleteTask = useIncompleteTask()
  const moveTask = useMoveTask()
  const { data: allItems = [] } = useItems({ include_archived: false })
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const drawerTriggerRef = useRef<HTMLElement | null>(null)

  function openTaskDrawer(taskId: number) {
    drawerTriggerRef.current = document.activeElement as HTMLElement | null
    setSelectedTaskId(taskId)
  }

  function closeTaskDrawer() {
    setSelectedTaskId(null)
    requestAnimationFrame(() => {
      drawerTriggerRef.current?.focus()
      drawerTriggerRef.current = null
    })
  }
  const [showCompleted, setShowCompleted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const openTasks = tasks.filter((t) => !t.is_complete)
  const completedTasks = tasks.filter((t) => t.is_complete)
  const destinations = allItems.filter((i) => i.type === "project" || i.type === "area")

  // Remove IDs that are no longer in openTasks (e.g. after individual or bulk move)
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const validIds = new Set(openTasks.map((t) => t.id))
      const filtered = new Set([...prev].filter((id) => validIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
  }, [openTasks])

  const allOpenSelected = openTasks.length > 0 && openTasks.every((t) => selectedIds.has(t.id))

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allOpenSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(openTasks.map((t) => t.id)))
    }
  }

  async function handleBulkMove(itemId: number) {
    const ids = Array.from(selectedIds)
    const target = allItems.find((i) => i.id === itemId)
    // Clear selection immediately so bar disappears regardless of outcome
    setSelectedIds(new Set())
    const results = await Promise.allSettled(
      ids.map((id) => moveTask.mutateAsync({ id, payload: { item_id: itemId } }))
    )
    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length
    if (succeeded > 0) {
      notify.success(
        `Moved ${succeeded} ${succeeded === 1 ? "task" : "tasks"} to ${target?.title ?? "item"}`
      )
    }
    if (failed > 0) {
      notify.error(
        `${failed} ${failed === 1 ? "task" : "tasks"} could not be moved.`
      )
    }
  }

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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && destinations.length > 0 && (
        <div className="mt-3 flex items-center gap-3 px-3 py-2 rounded-control bg-accent-soft border border-accent">
          <span className="text-sm font-medium text-accent-text">
            {selectedIds.size} {selectedIds.size === 1 ? "task" : "tasks"} selected
          </span>
          <BulkMoveSelect destinations={destinations} onMove={handleBulkMove} />
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted hover:text-text"
          >
            Clear selection
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted mt-4">Loading…</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Inbox zero."
          description="Everything has a home."
          dashedBorder
        />
      ) : (
        <div className="mt-4" role="list" aria-label="Inbox tasks">
          {/* Select-all header row */}
          {openTasks.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 mb-1">
              <input
                type="checkbox"
                checked={allOpenSelected}
                onChange={toggleSelectAll}
                aria-label="Select all open tasks"
                className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-xs text-muted">Select all</span>
            </div>
          )}

          <div className="space-y-1">
            {openTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2" role="listitem">
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(task.id)}
                  onChange={() => toggleSelect(task.id)}
                  aria-label={`Select task: ${task.title}`}
                  className="shrink-0 h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <TaskRow
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onOpenDrawer={openTaskDrawer}
                    onToggleComplete={handleToggleComplete}
                    isDraggable={false}
                  />
                </div>
                <RowMoveSelect task={task} destinations={destinations} />
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
                      onOpenDrawer={openTaskDrawer}
                      onToggleComplete={handleToggleComplete}
                      isDraggable={false}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <TaskDrawer taskId={selectedTaskId} onClose={closeTaskDrawer} />
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

// ---- Bulk move select (shown in the bulk action bar) ----

function BulkMoveSelect({
  destinations,
  onMove,
}: {
  destinations: Item[]
  onMove: (itemId: number) => void
}) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    if (!val) return
    onMove(Number(val))
    e.target.value = ""
  }
  return (
    <select
      defaultValue=""
      onChange={handleChange}
      aria-label="Move selected tasks to"
      className={cn(
        "h-8 px-2 text-sm rounded-control border border-accent bg-surface text-text",
        "focus:outline-2 focus:outline-offset-2 focus:outline-accent"
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

// ---- Per-row move select ----

function RowMoveSelect({ task, destinations }: { task: Task; destinations: Item[] }) {
  const moveTask = useMoveTask()

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
