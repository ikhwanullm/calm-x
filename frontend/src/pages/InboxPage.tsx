import { useState, useEffect, useRef } from "react"
import {
  useInboxTasks,
  useCompleteTask,
  useIncompleteTask,
  useMoveTask,
} from "@/hooks/useTasks"
import { useItems } from "@/hooks/useItems"
import { TaskDrawer } from "@/components/tasks/TaskDrawer"
import { TaskRow } from "@/components/tasks/TaskRow"
import { ConfirmDialog, EmptyState, ItemPicker } from "@/components/common"
import { BulkBar, InlineEdit, RowMenu } from "@/components/inbox/TriageControls"
import type { EditKind } from "@/components/inbox/TriageControls"
import { useTriage } from "@/hooks/useTriage"
import { getLocalToday } from "@/utils/date"
import { CaptureBox } from "@/components/capture/CaptureBox"
import { notify } from "@/lib/toast"
import type { Task, Item, TaskPriority, TaskUpdatePayload } from "@/types/models"

export default function InboxPage() {
  const { data: tasks = [], isLoading } = useInboxTasks()
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

  // ---- Triage: do one thing to one row or to every selected task ----
  const triage = useTriage()
  const today = getLocalToday()
  const [rowEdit, setRowEdit] = useState<{ id: number; kind: EditKind } | null>(null)
  const [deleting, setDeleting] = useState<Task[] | null>(null)
  const selectedTasks = openTasks.filter((t) => selectedIds.has(t.id))

  /** Apply a change to some tasks. The tasks leave the selection and any open row editor closes. */
  async function change(
    targets: Task[],
    build: (task: Task) => TaskUpdatePayload,
    text: (n: number) => string,
  ) {
    setRowEdit(null)
    setSelectedIds(new Set())
    await triage.updateMany(targets, build, text)
  }

  const plural = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`
  const todayChange = (targets: Task[]) =>
    change(targets, () => ({ focus_date: today }), (n) => `${plural(n)} added to Today`)
  const somedayChange = (targets: Task[]) =>
    change(targets, () => ({ is_someday: true }), (n) => `${plural(n)} moved to Someday`)
  const priorityChange = (targets: Task[], priority: TaskPriority) =>
    change(targets, () => ({ priority }), (n) => `Priority of ${plural(n)} set to ${priority}`)

  function applyValue(targets: Task[], kind: EditKind, value: string) {
    if (kind === "due") {
      return change(targets, () => ({ due_date: value }), (n) => `Due date set on ${plural(n)}`)
    }
    if (kind === "waiting") {
      return change(targets, () => ({ waiting_for: value }), (n) => `${plural(n)} now waiting for ${value}`)
    }
    const tag = value.replace(/^#/, "").toLowerCase()
    return change(
      targets,
      (t) => ({ tag_names: Array.from(new Set([...t.tags, tag])) }),
      (n) => `Tag #${tag} added to ${plural(n)}`,
    )
  }

  async function confirmDelete() {
    const targets = deleting ?? []
    setDeleting(null)
    setRowEdit(null)
    setSelectedIds(new Set())
    await triage.deleteMany(targets)
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

      <CaptureBox inputLabel="Capture task title" submitAriaLabel="Add to Inbox" />

      {/* Bulk action bar */}
      {selectedTasks.length > 0 && (
        <BulkBar
          count={selectedTasks.length}
          destinations={destinations}
          onMove={handleBulkMove}
          onPriority={(priority) => priorityChange(selectedTasks, priority)}
          onToday={() => todayChange(selectedTasks)}
          onSomeday={() => somedayChange(selectedTasks)}
          onDelete={() => setDeleting(selectedTasks)}
          onEditValue={(kind, value) => applyValue(selectedTasks, kind, value)}
          onClear={() => setSelectedIds(new Set())}
        />
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
              <div key={task.id} role="listitem">
              <div className="flex items-center gap-2">
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
                <RowMenu
                  task={task}
                  onToday={() => todayChange([task])}
                  onEdit={(kind) => setRowEdit({ id: task.id, kind })}
                  onSomeday={() => somedayChange([task])}
                  onDelete={() => setDeleting([task])}
                />
              </div>
              {rowEdit?.id === task.id && (
                <div className="ml-6 mt-1 mb-2">
                  <InlineEdit
                    key={rowEdit.kind}
                    kind={rowEdit.kind}
                    onSave={(value) => applyValue([task], rowEdit.kind, value)}
                    onCancel={() => setRowEdit(null)}
                  />
                </div>
              )}
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

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} tasks?` : "Delete task?"}
        description={
          deleting && deleting.length === 1
            ? `Delete "${deleting[0].title}"? You can undo it from the message that appears.`
            : "These tasks and their subtasks will be deleted. You can undo it from the message that appears."
        }
        confirmLabel={deleting && deleting.length > 1 ? "Delete tasks" : "Delete task"}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <TaskDrawer taskId={selectedTaskId} onClose={closeTaskDrawer} />
    </div>
  )
}

// ---- Per-row move select ----

function RowMoveSelect({ task, destinations }: { task: Task; destinations: Item[] }) {
  const moveTask = useMoveTask()

  if (destinations.length === 0) return null

  return (
    <ItemPicker
      items={destinations}
      onSelect={(itemId) =>
        moveTask.mutate(
          { id: task.id, payload: { item_id: itemId } },
          {
            onSuccess: () => notify.success("Task moved"),
            onError: (err: Error) => notify.error("Could not move task.", err.message),
          }
        )
      }
      placeholder="Move to…"
      ariaLabel={`Move "${task.title}" to project or area`}
      variant="row"
      align="right"
    />
  )
}
