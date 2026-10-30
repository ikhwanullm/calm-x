import { useState } from 'react'
import { useReviewWaiting } from '@/hooks/useReview'
import { useCompleteTask, useFollowUpTask, usePatchTask } from '@/hooks/useTasks'
import { formatRelativeDate, getLocalToday } from '@/utils/date'
import { REVIEW_BUTTON, ReviewTaskRow } from '@/components/review/ReviewTaskRow'

type Outcome = 'followed' | 'received' | 'released'

const OUTCOME_TEXT: Record<Outcome, string> = {
  followed: 'Followed up today. The wait is counted from now.',
  received: 'Marked done.',
  released: 'No longer waiting. It is a normal task again.',
}

interface WaitingStepProps {
  /** Called once per task that was followed up, finished or released. */
  onHandled: () => void
}

/** Chase every task that waits on someone: followed up, received, or no longer waiting. */
export function WaitingStep({ onHandled }: WaitingStepProps) {
  const today = getLocalToday()
  const { data: waits = [], isLoading } = useReviewWaiting()
  const followUp = useFollowUpTask()
  const complete = useCompleteTask()
  const patch = usePatchTask()
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({})

  async function run(id: number, outcome: Outcome, action: () => Promise<unknown>) {
    try {
      await action()
    } catch {
      return  // the hook already showed the error; the row keeps its buttons
    }
    setOutcomes((prev) => ({ ...prev, [id]: outcome }))
    onHandled()
  }

  const open = waits.filter((w) => !outcomes[w.id]).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Follow up on what you are waiting for
        </h1>
        <p className="mt-1 text-sm text-muted">
          Longest waits first. The days count from when the wait began or your last follow-up.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />)}
        </div>
      ) : waits.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">Nothing is waiting on anyone</span>
          <span className="text-muted text-sm">Tasks you hand to someone else with Waiting for show up here.</span>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted tabular-nums" aria-live="polite">
            {open === 0 ? 'All handled.' : `${open} of ${waits.length} still to check`}
          </p>
          <ul className="space-y-2" aria-label="Tasks you are waiting on">
            {waits.map((w) => {
              const outcome = outcomes[w.id]
              const where = w.item_title ?? 'Inbox'
              return (
                <ReviewTaskRow
                  key={w.id}
                  title={w.title}
                  subtitle={`${where} · waiting for ${w.waiting_for}${w.due_date ? ` · due ${formatRelativeDate(w.due_date, today).toLowerCase()}` : ''}`}
                  badge={
                    <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-pill bg-warn-bg text-xs text-warn-fg tabular-nums">
                      {w.waiting_days} {w.waiting_days === 1 ? 'day' : 'days'}
                    </span>
                  }
                  outcome={outcome ? OUTCOME_TEXT[outcome] : undefined}
                >
                  <button type="button" className={REVIEW_BUTTON} onClick={() => run(w.id, 'followed', () => followUp.mutateAsync(w.id))}>
                    Followed up
                  </button>
                  <button type="button" className={REVIEW_BUTTON} onClick={() => run(w.id, 'received', () => complete.mutateAsync(w.id))}>
                    Received, done
                  </button>
                  <button
                    type="button"
                    className={REVIEW_BUTTON}
                    onClick={() => run(w.id, 'released', () => patch.mutateAsync({ id: w.id, payload: { waiting_for: null } }))}
                  >
                    Not waiting anymore
                  </button>
                </ReviewTaskRow>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
