import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/common'
import { useReviewInbox, reviewKeys } from '@/hooks/useReview'
import { useItems } from '@/hooks/useItems'
import { useMoveTask, useCompleteTask, useDeleteTask, taskKeys } from '@/hooks/useTasks'
import { tasksApi } from '@/api/tasks'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useQueryClient } from '@tanstack/react-query'
import { notify } from '@/lib/toast'
import { formatRelativeDate, getLocalToday } from '@/utils/date'

interface InboxStepProps {
  onOrganized: () => void
  onCompleted: () => void
  onDeleted: () => void
}

export function InboxStep({ onOrganized, onCompleted, onDeleted }: InboxStepProps) {
  const qc = useQueryClient()
  const today = getLocalToday()
  const { data: tasks = [], isLoading } = useReviewInbox()
  const { data: allProjects = [] } = useItems({ type: 'project' })
  // A task should not be filed into a project that is already completed
  const projects = allProjects.filter(p => !('project_status' in p) || p.project_status !== 'completed')
  const { data: areas = [] } = useItems({ type: 'area' })

  const moveTask = useMoveTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()

  // ---------------------------------------------------------------------------
  // Single source of truth: a queue of task IDs.
  //   Skip  → rotate head to tail  (task stays unresolved, shows next one)
  //   Resolve → remove head (task is gone; move/complete/delete)
  // All display AND all actions reference taskQueue[0] exclusively.
  // ---------------------------------------------------------------------------
  const [taskQueue, setTaskQueue] = useState<number[]>([])
  const [initialCount, setInitialCount] = useState(0)
  const [seenCount, setSeenCount] = useState(0)   // increments on skip AND resolve → drives "n of N"
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && tasks.length > 0) {
      setTaskQueue(tasks.map(t => t.id))
      setInitialCount(tasks.length)
      initialized.current = true
    }
  }, [tasks])

  // Active task = always the HEAD of the queue
  const activeTaskId = taskQueue[0] ?? null
  const activeTask = tasks.find(t => t.id === activeTaskId) ?? null

  // Project/area select states — reset when active task changes
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')
  const [selectedAreaId, setSelectedAreaId] = useState<number | ''>('')
  const [moveError, setMoveError] = useState<'project' | 'area' | null>(null)

  useEffect(() => {
    if (projects.length > 0) setSelectedProjectId(projects[0].id)
    else setSelectedProjectId('')
    if (areas.length > 0) setSelectedAreaId(areas[0].id)
    else setSelectedAreaId('')
    setMoveError(null)
  }, [activeTaskId, projects.length, areas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ConfirmDialog for delete — stores the ID to delete (same task as displayed)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<number | null>(null)
  const deleteConfirmTask = tasks.find(t => t.id === deleteConfirmTaskId) ?? null

  // ---------------------------------------------------------------------------
  // Queue mutation helpers
  // ---------------------------------------------------------------------------

  function advanceQueue(removedId: number) {
    setTaskQueue(prev => prev.filter(id => id !== removedId))
    setSeenCount(c => c + 1)
    qc.invalidateQueries({ queryKey: reviewKeys.inbox() })
  }

  function skipQueue() {
    if (taskQueue.length <= 1) return  // nothing to rotate
    setTaskQueue(prev => [...prev.slice(1), prev[0]])
    setSeenCount(c => c + 1)
  }

  // ---------------------------------------------------------------------------
  // Action handlers — all use activeTask (= head of queue)
  // ---------------------------------------------------------------------------

  // One action at a time: a second keypress while the first is still being saved would act on the same task
  // again (or on the next one before it is on screen). A failed save leaves the task where it is; the
  // move/complete/delete hooks already show their own error message.
  const busy = useRef(false)
  async function once(action: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    try {
      await action()
    } catch {
      // keep the task in the queue
    } finally {
      busy.current = false
    }
  }

  const handleMoveToProject = useCallback(() => once(async () => {
    if (!activeTask) return
    if (!selectedProjectId) {
      setMoveError('project')
      return
    }
    await moveTask.mutateAsync({ id: activeTask.id, payload: { item_id: Number(selectedProjectId) } })
    advanceQueue(activeTask.id)
    onOrganized()
  }), [activeTask, selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMoveToArea = useCallback(() => once(async () => {
    if (!activeTask) return
    if (!selectedAreaId) {
      setMoveError('area')
      return
    }
    await moveTask.mutateAsync({ id: activeTask.id, payload: { item_id: Number(selectedAreaId) } })
    advanceQueue(activeTask.id)
    onOrganized()
  }), [activeTask, selectedAreaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(() => once(async () => {
    if (!activeTask) return
    await completeTask.mutateAsync(activeTask.id)
    advanceQueue(activeTask.id)
    onCompleted()
  }), [activeTask]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSomeday = useCallback(() => once(async () => {
    if (!activeTask) return
    try {
      await tasksApi.update(activeTask.id, { is_someday: true })
    } catch (err) {
      notify.error("Couldn't move the task to Someday. Try again.", (err as Error).message)
      return
    }
    qc.invalidateQueries({ queryKey: taskKeys.all })
    advanceQueue(activeTask.id)
    onOrganized()
  }), [activeTask]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = useCallback(() => {
    if (!activeTask) return
    skipQueue()
  }, [activeTask]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteConfirm = useCallback(() => once(async () => {
    if (!deleteConfirmTask) return
    const id = deleteConfirmTask.id
    await deleteTask.mutateAsync(id)
    advanceQueue(id)
    setDeleteConfirmTaskId(null)
    onDeleted()
  }), [deleteConfirmTask]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts — active task is ALWAYS the same as the displayed task
  useShortcuts({
    P: () => { if (!deleteConfirmTask) handleMoveToProject() },
    A: () => { if (!deleteConfirmTask) handleMoveToArea() },
    C: () => { if (!deleteConfirmTask) handleComplete() },
    M: () => { if (!deleteConfirmTask) handleSomeday() },
    D: () => { if (!deleteConfirmTask && activeTask) setDeleteConfirmTaskId(activeTask.id) },
    S: () => { if (!deleteConfirmTask) handleSkip() },
  })

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const isProcessed = taskQueue.length === 0 && initialized.current
  // n = seenCount + 1, capped at initialCount
  const displayN = Math.min(seenCount + 1, initialCount)
  const displayTotal = initialCount
  const progressPct = initialCount === 0 ? 100 : Math.round(((initialCount - taskQueue.length) / initialCount) * 100)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Process your Inbox
        </h1>
        <p className="text-muted">Give every captured task a home, finish it, or let it go.</p>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-2xl bg-surface border border-border animate-pulse" />
      ) : isProcessed ? (
        <section className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">Inbox processed</span>
          <span className="text-muted text-sm">
            {initialCount > 0
              ? `${initialCount} task${initialCount === 1 ? '' : 's'} given a home or completed.`
              : 'Your inbox was empty.'}
          </span>
        </section>
      ) : activeTask === null ? (
        <section className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">Inbox is empty</span>
          <span className="text-muted text-sm">No open tasks to process.</span>
        </section>
      ) : (
        <section
          aria-labelledby="inbox-task-title"
          className="flex flex-col gap-5 p-6 border border-border rounded-2xl bg-surface shadow-[var(--shadow)]"
        >
          {/* Progress — n advances on skip AND resolve */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-muted tabular-nums">
              Task {displayN} of {displayTotal}
            </span>
            <div
              role="progressbar"
              aria-label="Inbox progress"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="flex-1 h-1 rounded-full bg-track overflow-hidden"
            >
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Task title — always activeTask (head of queue) */}
          <div className="flex flex-col gap-1">
            <h2 id="inbox-task-title" className="text-xl font-semibold text-text">
              {activeTask.title}
            </h2>
            <span className="text-sm text-muted">
              Captured{' '}
              <time
                dateTime={activeTask.created_at.split('T')[0]}
                title={activeTask.created_at}
                className="underline decoration-dotted underline-offset-2"
              >
                {formatRelativeDate(activeTask.created_at.split('T')[0], today).toLowerCase()}
              </time>
            </span>
          </div>

          {/* Move controls */}
          <div className="grid grid-cols-2 gap-3">
            {/* Move to project */}
            <div className="flex flex-col gap-2 p-3.5 border border-border rounded-xl">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-text">
                Project
                <select
                  value={selectedProjectId}
                  onChange={e => { setSelectedProjectId(e.target.value ? Number(e.target.value) : ''); setMoveError(null) }}
                  className={cn(
                    'h-11 px-2.5 border border-border rounded-control bg-bg text-text text-sm',
                    'focus:outline-2 focus:outline-accent',
                    moveError === 'project' && 'border-danger-fg'
                  )}
                  aria-label="Select project to move task to"
                >
                  <option value="">{projects.length === 0 ? 'No projects yet' : 'Select project…'}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                {moveError === 'project' && (
                  <span className="text-xs text-danger-fg">Select a project first</span>
                )}
              </label>
              <button
                type="button"
                onClick={handleMoveToProject}
                disabled={projects.length === 0 || moveTask.isPending}
                className="h-11 rounded-control bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <span>Move to project</span>
                <span className="ml-2 text-xs opacity-70">[P]</span>
              </button>
            </div>

            {/* Move to area */}
            <div className="flex flex-col gap-2 p-3.5 border border-border rounded-xl">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-text">
                Area
                <select
                  value={selectedAreaId}
                  onChange={e => { setSelectedAreaId(e.target.value ? Number(e.target.value) : ''); setMoveError(null) }}
                  className={cn(
                    'h-11 px-2.5 border border-border rounded-control bg-bg text-text text-sm',
                    'focus:outline-2 focus:outline-accent',
                    moveError === 'area' && 'border-danger-fg'
                  )}
                  aria-label="Select area to move task to"
                >
                  <option value="">{areas.length === 0 ? 'No areas yet' : 'Select area…'}</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
                {moveError === 'area' && (
                  <span className="text-xs text-danger-fg">Select an area first</span>
                )}
              </label>
              <button
                type="button"
                onClick={handleMoveToArea}
                disabled={areas.length === 0 || moveTask.isPending}
                className="h-11 rounded-control border border-accent text-accent-text bg-surface text-sm font-semibold hover:bg-accent-soft disabled:opacity-50"
              >
                <span>Move to area</span>
                <span className="ml-2 text-xs opacity-70">[A]</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleComplete}
              disabled={completeTask.isPending}
              className="flex-1 h-11 rounded-control border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
            >
              Mark complete <span className="text-xs text-muted">[C]</span>
            </button>
            <button
              type="button"
              onClick={handleSomeday}
              className="flex-1 h-11 rounded-control border border-border bg-surface text-text text-sm font-semibold hover:bg-surface-2"
            >
              Someday <span className="text-xs text-muted">[M]</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirmTaskId(activeTask.id)}
              className="flex-1 h-11 rounded-control border border-border bg-surface text-danger-fg text-sm font-semibold hover:bg-danger-bg"
            >
              Delete <span className="text-xs opacity-70">[D]</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={taskQueue.length <= 1}
              className="flex-1 h-11 rounded-control border border-border bg-surface text-muted text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
            >
              Skip, keep in Inbox <span className="text-xs opacity-70">[S]</span>
            </button>
          </div>
        </section>
      )}

      {/* Delete confirmation — uses deleteConfirmTask (set from activeTask.id) */}
      <ConfirmDialog
        open={deleteConfirmTaskId !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmTaskId(null) }}
        title="Delete task"
        description={`Delete "${deleteConfirmTask?.title ?? 'this task'}"? You can undo it from the message that appears.`}
        confirmLabel="Delete task"
        onConfirm={handleDeleteConfirm}
        destructive
      />
    </div>
  )
}
