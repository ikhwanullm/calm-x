import type { ActionCounts } from '@/pages/WeeklyReviewPage'

interface SummaryStepProps {
  actionCounts: ActionCounts
  notes: string
  onNotesChange: (notes: string) => void
}

const MAX_NOTES = 500

export function SummaryStep({ actionCounts, notes, onNotesChange }: SummaryStepProps) {
  const stats = [
    { value: actionCounts.organizedInbox, label: 'Inbox tasks given a home' },
    { value: actionCounts.completed, label: 'Tasks completed' },
    { value: actionCounts.updatedDueDates, label: 'Due dates updated' },
    { value: actionCounts.archived, label: 'Items archived' },
    { value: actionCounts.tasksAdded, label: 'Next steps added' },
    { value: actionCounts.followedUp, label: 'Waiting tasks followed up or closed' },
    { value: actionCounts.startedIdeas, label: 'Someday ideas started' },
    { value: actionCounts.droppedIdeas, label: 'Someday ideas dropped' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Summary
        </h1>
        <p className="text-muted">Here is what changed this review. Add a note for future you.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ value, label }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 p-4 border border-border rounded-xl bg-surface"
          >
            <span className="text-[26px] font-semibold tabular-nums text-text leading-tight">
              {value}
            </span>
            <span className="text-muted text-[13px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Notes textarea */}
      <label className="flex flex-col gap-2 text-sm font-semibold text-text">
        Notes for this week
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value.slice(0, MAX_NOTES))}
          maxLength={MAX_NOTES}
          rows={5}
          placeholder="What went well? What needs attention next week?"
          className="w-full px-3 py-2.5 rounded-control border border-border bg-surface text-text text-sm font-normal resize-y focus:outline-2 focus:outline-accent placeholder:text-muted"
          aria-label="Review notes (maximum 500 characters)"
        />
        <span className="self-end text-xs text-muted tabular-nums font-normal">
          {notes.length}/{MAX_NOTES}
        </span>
      </label>
    </div>
  )
}
