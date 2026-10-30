import { useState } from 'react'
import { useDeleteTask, usePatchTask, useSomedayTasks } from '@/hooks/useTasks'
import { daysSinceIso, getLocalToday } from '@/utils/date'
import { REVIEW_BUTTON, ReviewTaskRow } from '@/components/review/ReviewTaskRow'

type Outcome = 'kept' | 'activated' | 'dropped'

const OUTCOME_TEXT: Record<Outcome, string> = {
  kept: 'Stays parked.',
  activated: 'Back in play. It shows up in its project again.',
  dropped: 'Deleted. You can undo it from the message that appeared.',
}

interface SomedayStepProps {
  onActivated: () => void
  onDropped: () => void
}

/** Look at every parked idea: promote it, keep it parked, or let it go. */
export function SomedayStep({ onActivated, onDropped }: SomedayStepProps) {
  const today = getLocalToday()
  const { data: tasks = [], isLoading } = useSomedayTasks()
  const patch = usePatchTask()
  const deleteTask = useDeleteTask()
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({})
  // The list is fixed for the step: a parked idea that was just handled stays on screen with its outcome
  const [initial, setInitial] = useState<typeof tasks | null>(null)
  const list = initial ?? tasks
  if (initial === null && !isLoading && tasks.length > 0) setInitial(tasks)

  function mark(id: number, outcome: Outcome) {
    setOutcomes((prev) => ({ ...prev, [id]: outcome }))
  }

  async function activate(id: number) {
    try {
      await patch.mutateAsync({ id, payload: { is_someday: false } })
    } catch {
      return
    }
    mark(id, 'activated')
    onActivated()
  }

  async function drop(id: number) {
    try {
      await deleteTask.mutateAsync(id)
    } catch {
      return
    }
    mark(id, 'dropped')
    onDropped()
  }

  const open = list.filter((t) => !outcomes[t.id]).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Revisit your Someday ideas
        </h1>
        <p className="mt-1 text-sm text-muted">Is it time to start one, or to let it go? Oldest first.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">No parked ideas</span>
          <span className="text-muted text-sm">Move a task to Someday from its drawer to park it here.</span>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted tabular-nums" aria-live="polite">
            {open === 0 ? 'All handled.' : `${open} of ${list.length} still to decide`}
          </p>
          <ul className="space-y-2" aria-label="Someday ideas">
            {[...list].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id).map((t) => {
              const outcome = outcomes[t.id]
              const age = daysSinceIso(t.created_at, today)
              return (
                <ReviewTaskRow
                  key={t.id}
                  title={t.title}
                  subtitle={`${t.item_title ?? 'Inbox'} · parked ${age <= 0 ? 'today' : `${age} ${age === 1 ? 'day' : 'days'} ago`}`}
                  outcome={outcome ? OUTCOME_TEXT[outcome] : undefined}
                >
                  <button type="button" className={REVIEW_BUTTON} onClick={() => activate(t.id)}>Start it</button>
                  <button type="button" className={REVIEW_BUTTON} onClick={() => mark(t.id, 'kept')}>Keep parked</button>
                  <button type="button" className={REVIEW_BUTTON} onClick={() => drop(t.id)}>Drop</button>
                </ReviewTaskRow>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
