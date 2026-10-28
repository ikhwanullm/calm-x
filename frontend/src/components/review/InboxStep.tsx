import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/common'
import { useReviewInbox, type ReviewTaskItem } from '@/hooks/useReview'
import { useItems } from '@/hooks/useItems'
import { useMoveTask, useCompleteTask, useDeleteTask } from '@/hooks/useTasks'
import { useShortcuts } from '@/hooks/useShortcuts'
import { reviewKeys } from '@/hooks/useReview'
import { useQueryClient } from '@tanstack/react-query'
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
  const { data: projects = [] } = useItems({ type: 'project' })
  const { data: areas = [] } = useItems({ type: 'area' })

  const moveTask = useMoveTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()

  const [currentIdx, setCurrentIdx] = useState(0)
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set())
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<ReviewTaskItem | null>(null)

  // Project/area select states
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')
  const [selectedAreaId, setSelectedAreaId] = useState<number | ''>('')

  // Remaining tasks (not yet resolved)
  const remaining = tasks.filter(t => !resolvedIds.has(t.id))
  const currentTask = remaining[0] ?? null
  const processedCount = tasks.length - remaining.length
  const totalCount = tasks.length

  // Reset selects when task changes
  useEffect(() => {
    if (projects.length > 0) setSelectedProjectId(projects[0].id)
    if (areas.length > 0) setSelectedAreaId(areas[0].id)
  }, [currentTask?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function resolveTask(id: number) {
    setResolvedIds(prev => new Set([...prev, id]))
    // Refresh inbox query for other parts of the app
    qc.invalidateQueries({ queryKey: reviewKeys.inbox() })
  }

  const handleMoveToProject = useCallback(async () => {
    if (!currentTask || !selectedProjectId) return
    await moveTask.mutateAsync({ id: currentTask.id, payload: { item_id: Number(selectedProjectId) } })
    resolveTask(currentTask.id)
    onOrganized()
  }, [currentTask, selectedProjectId, moveTask, onOrganized]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMoveToArea = useCallback(async () => {
    if (!currentTask || !selectedAreaId) return
    await moveTask.mutateAsync({ id: currentTask.id, payload: { item_id: Number(selectedAreaId) } })
    resolveTask(currentTask.id)
    onOrganized()
  }, [currentTask, selectedAreaId, moveTask, onOrganized]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(async () => {
    if (!currentTask) return
    await completeTask.mutateAsync(currentTask.id)
    resolveTask(currentTask.id)
    onCompleted()
  }, [currentTask, completeTask, onCompleted]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = useCallback(() => {
    if (!currentTask) return
    // Move current task to end of remaining list (treat as "skip")
    setResolvedIds(prev => {
      const next = new Set(prev)
      // Remove first occurrence — put it at back by re-appending
      return next
    })
    // Actually: rotate tasks by moving currentIdx forward
    setCurrentIdx(i => i + 1)
  }, [currentTask]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmTask) return
    await deleteTask.mutateAsync(deleteConfirmTask.id)
    resolveTask(deleteConfirmTask.id)
    setDeleteConfirmTask(null)
    onDeleted()
  }, [deleteConfirmTask, deleteTask, onDeleted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts — only when no dialog open
  useShortcuts({
    P: () => { if (!deleteConfirmTask) handleMoveToProject() },
    A: () => { if (!deleteConfirmTask) handleMoveToArea() },
    C: () => { if (!deleteConfirmTask) handleComplete() },
    D: () => { if (!deleteConfirmTask && currentTask) setDeleteConfirmTask(currentTask) },
    S: () => { if (!deleteConfirmTask) handleSkip() },
  })

  // Progress pct
  const progressPct = totalCount === 0 ? 100 : Math.round((processedCount / totalCount) * 100)

  // Rotate the display: skip means go to next in remaining
  const displayTask = remaining[currentIdx % Math.max(remaining.length, 1)] ?? null

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
      ) : displayTask === null ? (
        <section className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">Inbox processed</span>
          <span className="text-muted text-sm">
            {processedCount > 0
              ? `${processedCount} task${processedCount === 1 ? '' : 's'} given a home or completed.`
              : 'Your inbox was empty.'}
          </span>
        </section>
      ) : (
        <section
          aria-labelledby="inbox-task-title"
          className="flex flex-col gap-5 p-6 border border-border rounded-2xl bg-surface shadow-[var(--shadow)]"
        >
          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-muted tabular-nums">
              Task {processedCount + 1} of {totalCount}
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

          {/* Task title + captured date */}
          <div className="flex flex-col gap-1">
            <h2 id="inbox-task-title" className="text-xl font-semibold text-text">
              {displayTask.title}
            </h2>
            <span className="text-sm text-muted">
              Captured{' '}
              <time
                dateTime={displayTask.created_at.split('T')[0]}
                title={displayTask.created_at}
                className="underline decoration-dotted underline-offset-2"
              >
                {formatRelativeDate(displayTask.created_at.split('T')[0], today).toLowerCase()}
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
                  onChange={e => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                  className={cn(
                    'h-11 px-2.5 border border-border rounded-control bg-bg text-text text-sm',
                    'focus:outline-2 focus:outline-accent'
                  )}
                  aria-label="Select project to move task to"
                >
                  <option value="">Select project…</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleMoveToProject}
                disabled={!selectedProjectId || moveTask.isPending}
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
                  onChange={e => setSelectedAreaId(e.target.value ? Number(e.target.value) : '')}
                  className={cn(
                    'h-11 px-2.5 border border-border rounded-control bg-bg text-text text-sm',
                    'focus:outline-2 focus:outline-accent'
                  )}
                  aria-label="Select area to move task to"
                >
                  <option value="">Select area…</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleMoveToArea}
                disabled={!selectedAreaId || moveTask.isPending}
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
              onClick={() => setDeleteConfirmTask(displayTask)}
              className="flex-1 h-11 rounded-control border border-border bg-surface text-danger-fg text-sm font-semibold hover:bg-danger-bg"
            >
              Delete <span className="text-xs opacity-70">[D]</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 h-11 rounded-control border border-border bg-surface text-muted text-sm font-semibold hover:bg-surface-2"
            >
              Skip, keep in Inbox <span className="text-xs opacity-70">[S]</span>
            </button>
          </div>
        </section>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirmTask !== null}
        onOpenChange={open => { if (!open) setDeleteConfirmTask(null) }}
        title="Delete task"
        description={`Delete "${deleteConfirmTask?.title ?? 'this task'}"? This cannot be undone.`}
        confirmLabel="Delete task"
        onConfirm={handleDeleteConfirm}
        destructive
      />
    </div>
  )
}
