import { useState } from 'react'
import { Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReviewAreas, type ReviewAreaItem, reviewKeys } from '@/hooks/useReview'
import { useCreateTask } from '@/hooks/useTasks'
import { useQueryClient } from '@tanstack/react-query'
import { getLocalToday } from '@/utils/date'

interface AreasStepProps {
  onTaskAdded: () => void
}

export function AreasStep({ onTaskAdded }: AreasStepProps) {
  const qc = useQueryClient()
  const today = getLocalToday()
  const { data: areas = [], isLoading } = useReviewAreas()
  const createTask = useCreateTask()

  // Track "Looks good" per area and "adding task" per area
  const [okAreas, setOkAreas] = useState<Set<number>>(new Set())
  const [addingForArea, setAddingForArea] = useState<number | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [taskTitleError, setTaskTitleError] = useState('')

  function toggleOk(areaId: number) {
    setOkAreas(prev => {
      const next = new Set(prev)
      if (next.has(areaId)) next.delete(areaId)
      else next.add(areaId)
      return next
    })
  }

  async function handleAddTask(areaId: number) {
    if (!newTaskTitle.trim()) {
      setTaskTitleError('Task title is required')
      return
    }
    await createTask.mutateAsync({ title: newTaskTitle.trim(), item_id: areaId })
    qc.invalidateQueries({ queryKey: reviewKeys.areas(today) })
    setAddingForArea(null)
    setNewTaskTitle('')
    setTaskTitleError('')
    onTaskAdded()
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Check your areas
        </h1>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (areas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Check your areas
        </h1>
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">No active areas</span>
          <span className="text-muted text-sm">Create an area to track ongoing responsibilities.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Check your areas
        </h1>
        <p className="text-muted">
          Is every area of responsibility being maintained? Add a task where one is missing.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {areas.map(area => (
          <AreaRow
            key={area.id}
            area={area}
            isOk={okAreas.has(area.id)}
            onToggleOk={() => toggleOk(area.id)}
            isAddingTask={addingForArea === area.id}
            newTaskTitle={addingForArea === area.id ? newTaskTitle : ''}
            taskTitleError={addingForArea === area.id ? taskTitleError : ''}
            onNewTaskTitleChange={v => { setNewTaskTitle(v); setTaskTitleError('') }}
            onStartAddTask={() => { setAddingForArea(area.id); setNewTaskTitle('') }}
            onSaveTask={() => handleAddTask(area.id)}
            onCancelAddTask={() => { setAddingForArea(null); setNewTaskTitle(''); setTaskTitleError('') }}
            isPending={createTask.isPending}
          />
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AreaRow subcomponent
// ---------------------------------------------------------------------------

interface AreaRowProps {
  area: ReviewAreaItem
  isOk: boolean
  onToggleOk: () => void
  isAddingTask: boolean
  newTaskTitle: string
  taskTitleError: string
  onNewTaskTitleChange: (v: string) => void
  onStartAddTask: () => void
  onSaveTask: () => void
  onCancelAddTask: () => void
  isPending: boolean
}

function AreaRow({
  area, isOk, onToggleOk,
  isAddingTask, newTaskTitle, taskTitleError,
  onNewTaskTitleChange, onStartAddTask, onSaveTask, onCancelAddTask,
  isPending,
}: AreaRowProps) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3.5 border border-border rounded-xl bg-surface shadow-[var(--shadow)]">
      {/* Area info */}
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="font-semibold text-sm text-text">{area.title}</span>
        <span className="text-muted text-[13px]">
          {area.open_task_count} open task{area.open_task_count === 1 ? '' : 's'}
          {area.next_task_title ? ` · Next: ${area.next_task_title}` : ''}
        </span>

        {/* Add task form (inline) */}
        {isAddingTask && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => onNewTaskTitleChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onSaveTask()
                  if (e.key === 'Escape') onCancelAddTask()
                }}
                placeholder="New task title…"
                autoFocus
                aria-label={`Add task to ${area.title}`}
                className={cn(
                  'w-full h-9 px-2.5 rounded-control border bg-surface text-text text-sm',
                  'focus:outline-2 focus:outline-accent',
                  taskTitleError ? 'border-danger-fg' : 'border-border'
                )}
              />
              {taskTitleError && (
                <p className="mt-0.5 text-xs text-danger-fg">{taskTitleError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onSaveTask}
              disabled={isPending}
              className="h-9 px-3 rounded-control bg-accent text-accent-fg text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={onCancelAddTask}
              className="h-9 px-3 rounded-control border border-border text-muted text-[13px] font-semibold hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Overdue badge */}
      {area.is_stale && (
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-pill bg-warn-bg text-warn-fg text-xs font-semibold shrink-0">
          <AlertCircle size={12} strokeWidth={2} aria-hidden="true" />
          Stale
        </span>
      )}

      {/* Add task button */}
      {!isAddingTask && (
        <button
          type="button"
          onClick={onStartAddTask}
          className="h-9 px-3 rounded-control text-accent-text text-[13px] font-semibold bg-transparent hover:bg-accent-soft"
        >
          <Plus size={14} strokeWidth={2} className="inline -mt-0.5" aria-hidden="true" />
          {' '}Add task
        </button>
      )}

      {/* Looks good toggle */}
      <button
        type="button"
        onClick={onToggleOk}
        aria-pressed={isOk}
        className={cn(
          'h-9 px-3 rounded-control border text-[13px] font-semibold shrink-0',
          isOk
            ? 'border-ok-fg bg-ok-bg text-ok-fg'
            : 'border-border bg-surface text-text hover:bg-surface-2'
        )}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline -mt-0.5 mr-1">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
        {isOk ? 'Looks good' : 'Looks good?'}
      </button>
    </li>
  )
}
