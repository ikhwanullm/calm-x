// Placeholder — implemented in task 9.10
import type { ActionCounts } from '@/pages/WeeklyReviewPage'
interface SummaryStepProps {
  actionCounts: ActionCounts
  notes: string
  onNotesChange: (notes: string) => void
}
export function SummaryStep({ notes, onNotesChange }: SummaryStepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text tracking-tight">Summary</h1>
      <p className="text-muted mt-1">Here is what changed this review. Add a note for future you.</p>
      <textarea
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder="What went well? What needs attention next week?"
        rows={4}
        maxLength={500}
        className="mt-4 w-full px-3 py-2 rounded-control border border-border bg-surface text-text text-sm resize-none focus:outline-2 focus:outline-accent"
      />
    </div>
  )
}
