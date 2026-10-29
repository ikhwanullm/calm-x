import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useCreateMeeting, useItemMeetings } from '@/hooks/useMeetings'
import { Button } from '@/components/common'
import { actionsLabel, defaultMeetingTitle, formatMeetingTime, MEETING_TEMPLATE } from '@/utils/meeting'

interface MeetingsSectionProps {
  itemId: number
  itemTitle: string
  isArchived: boolean
}

/** Meetings of a Project or Area, newest first, with "+ Meeting". */
export function MeetingsSection({ itemId, itemTitle, isArchived }: MeetingsSectionProps) {
  const navigate = useNavigate()
  const { data: meetings = [] } = useItemMeetings(itemId)
  const createMeeting = useCreateMeeting(itemId)

  function handleNew() {
    createMeeting.mutate(
      { title: defaultMeetingTitle(itemTitle), held_at: new Date().toISOString(), body: MEETING_TEMPLATE },
      { onSuccess: (meeting) => navigate(`/meetings/${meeting.id}`) }
    )
  }

  return (
    <section className="mt-6" aria-labelledby={`item-${itemId}-meetings`}>
      <div className="flex items-center justify-between mb-2">
        <h2 id={`item-${itemId}-meetings`} className="text-xs font-semibold text-muted uppercase tracking-wide">
          Meetings <span className="font-normal tabular-nums">{meetings.length || ''}</span>
        </h2>
        {!isArchived && (
          <Button type="button" variant="secondary" size="sm" onClick={handleNew} disabled={createMeeting.isPending}>
            <Plus size={14} aria-hidden="true" />
            Meeting
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted">
          No meetings yet.{isArchived ? '' : ' Add one to keep notes and turn action lines into tasks.'}
        </p>
      ) : (
        <ul className="space-y-1" aria-label="Meetings">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link
                to={`/meetings/${m.id}`}
                className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-2"
              >
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-text">{m.title}</span>
                  <span className="block text-xs text-muted">{formatMeetingTime(m.held_at)}</span>
                </span>
                {m.open_action_count > 0 && (
                  <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-pill bg-accent-soft text-xs text-accent-text">
                    {actionsLabel(m.open_action_count)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
