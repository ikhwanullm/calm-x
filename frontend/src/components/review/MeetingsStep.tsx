import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useReviewMeetings } from '@/hooks/useReview'
import { useCloseMeetingActions } from '@/hooks/useMeetings'
import { actionsLabel, formatMeetingTime } from '@/utils/meeting'
import { cn } from '@/lib/utils'
import type { MeetingSummary } from '@/types/models'

/**
 * Meetings of the past week that still have action lines to turn into tasks.
 * Process opens the meeting in a new tab so the review keeps its place (the list refreshes when this tab regains focus).
 * "Nothing more" says there is nothing to turn into a task: the row stays, dimmed, like in the Waiting for step.
 */
export function MeetingsStep() {
  const { data: meetings = [], isLoading } = useReviewMeetings()
  const closeActions = useCloseMeetingActions()
  // Closed here: kept on screen after the list drops them, so the step does not jump
  const [closed, setClosed] = useState<MeetingSummary[]>([])

  const closedIds = new Set(closed.map((m) => m.id))
  const rows = [...meetings.filter((m) => !closedIds.has(m.id)), ...closed].sort(
    (a, b) => b.held_at.localeCompare(a.held_at) || b.id - a.id,
  )

  function handleNothingMore(meeting: MeetingSummary) {
    closeActions.mutate(meeting.id, { onSuccess: () => setClosed((prev) => [...prev, meeting]) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Process your meetings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Meetings from the past 7 days with actions not yet turned into tasks. Actions are optional: choose Nothing more when
          there is nothing to turn into a task.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">Nothing to process</span>
          <span className="text-muted text-sm">Every action from this week's meetings is already a task.</span>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Meetings to process">
          {rows.map((m) => {
            const done = closedIds.has(m.id)
            return (
              <li
                key={m.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface',
                  done && 'opacity-60',
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-semibold text-text">{m.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {m.item_title} · {formatMeetingTime(m.held_at)}
                  </span>
                </span>
                {done ? (
                  <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-pill bg-surface-2 text-xs text-muted">
                    No more actions
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-pill bg-accent-soft text-xs text-accent-text">
                    {actionsLabel(m.open_action_count)}
                  </span>
                )}
                {!done && (
                  <button
                    type="button"
                    onClick={() => handleNothingMore(m)}
                    disabled={closeActions.isPending}
                    aria-label={`Nothing more to process in ${m.title}`}
                    className="shrink-0 h-9 px-3 rounded-control text-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50"
                  >
                    Nothing more
                  </button>
                )}
                <a
                  href={`/meetings/${m.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-control border border-border bg-surface text-sm font-semibold text-text hover:bg-surface-2"
                >
                  Process
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only">{m.title} in a new tab</span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
