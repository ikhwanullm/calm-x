import { TaskRow } from '@/components/tasks/TaskRow'
import { useQueryClient } from '@tanstack/react-query'
import { UNDO_TOAST_MS, refreshAfterTaskChange, usePatchTask } from '@/hooks/useTasks'
import { tasksApi } from '@/api/tasks'
import { notify } from '@/lib/toast'
import { plannedLabel } from '@/utils/date'
import type { Task } from '@/types/models'

const BUTTON = 'h-8 px-3 rounded-control border border-border bg-surface text-xs font-medium text-text hover:bg-surface-2 disabled:opacity-50'

interface PlannedEarlierProps {
  /** Open tasks whose "Add to Today" was on an earlier day */
  tasks: Task[]
  today: string
  selectedTaskId: number | null
  onOpenDrawer: (taskId: number) => void
  onToggleComplete: (task: Task) => void
}

/**
 * "Add to Today" plans do not expire by themselves, so the ones from earlier days are listed apart, oldest first,
 * and the owner decides: keep a plan for today, or take it off Today (one by one, or all at once with Undo).
 */
export function PlannedEarlier({ tasks, today, selectedTaskId, onOpenDrawer, onToggleComplete }: PlannedEarlierProps) {
  const patch = usePatchTask()
  const qc = useQueryClient()

  if (tasks.length === 0) return null

  const ordered = [...tasks].sort((a, b) => (a.focus_date ?? '').localeCompare(b.focus_date ?? '') || a.id - b.id)

  /** Take every plan off Today in one go; the Undo puts each date back (done here, no server snapshot is needed). */
  async function clearAll() {
    const before = ordered.map((t) => ({ id: t.id, focus_date: t.focus_date }))
    const results = await Promise.allSettled(before.map((b) => tasksApi.update(b.id, { focus_date: null })))
    const cleared = before.filter((_, i) => results[i].status === 'fulfilled')
    const failed = before.length - cleared.length
    if (cleared.length > 0) {
      refreshAfterTaskChange(qc)
      notify.success(`Removed ${cleared.length} ${cleared.length === 1 ? 'task' : 'tasks'} from Today`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void Promise.allSettled(cleared.map((b) => tasksApi.update(b.id, { focus_date: b.focus_date })))
              .then(() => refreshAfterTaskChange(qc))
          },
        },
        duration: UNDO_TOAST_MS,
      })
    }
    if (failed > 0) notify.error(`${failed} ${failed === 1 ? 'task' : 'tasks'} could not be removed.`)
  }

  return (
    <section aria-labelledby="today-earlier" className="mt-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 id="today-earlier" className="text-xs font-semibold text-muted uppercase tracking-wide">
          Planned earlier <span className="font-normal tabular-nums">{ordered.length}</span>
        </h2>
        <button type="button" onClick={() => void clearAll()} className={BUTTON}>
          Clear all ({ordered.length})
        </button>
      </div>
      <p className="text-xs text-muted mb-2">These were added to Today on an earlier day. Keep the ones you still mean to do today.</p>
      <ul className="space-y-1" aria-label="Planned earlier">
        {ordered.map((task) => (
          <li key={task.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <TaskRow
                task={task}
                isSelected={selectedTaskId === task.id}
                onOpenDrawer={onOpenDrawer}
                onToggleComplete={onToggleComplete}
                isDraggable={false}
                showItem
              />
            </div>
            <span className="shrink-0 text-xs text-muted whitespace-nowrap">{plannedLabel(task.focus_date!, today)}</span>
            <button
              type="button"
              className={BUTTON}
              onClick={() => patch.mutate({ id: task.id, payload: { focus_date: today } })}
            >
              Keep for today
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => patch.mutate({ id: task.id, payload: { focus_date: null } })}
            >
              Remove from Today
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
