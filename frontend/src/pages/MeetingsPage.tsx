import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useMeetings } from '@/hooks/useMeetings'
import { EmptyState, Skeleton } from '@/components/common'
import { actionsLabel, formatMeetingTime, groupByWeek } from '@/utils/meeting'

export default function MeetingsPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data: meetings = [], isLoading, isError } = useMeetings(debounced)
  const groups = groupByWeek(meetings)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-text tracking-tight" style={{ letterSpacing: '-0.02em' }}>
        Meetings
        {meetings.length > 0 && (
          <span className="ml-2 text-muted font-normal text-lg tabular-nums">{meetings.length}</span>
        )}
      </h1>
      <p className="text-sm text-muted mt-1">
        Notes from your meetings, newest first. Open a project or area and choose + Meeting to add one.
      </p>

      <div className="relative mt-4">
        <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, attendees and notes"
          aria-label="Search meetings"
          className="w-full h-10 pl-9 pr-3 rounded-control border border-border bg-surface text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" delay={0} />)}
        </div>
      ) : isError ? (
        <p className="mt-6 text-sm text-danger-fg">
          Couldn&apos;t load meetings. Check that the server is running and try again.
        </p>
      ) : meetings.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={debounced.trim() ? 'No meetings match your search.' : 'No meetings yet.'}
            description={
              debounced.trim()
                ? 'Try a different word, or part of a name.'
                : 'Open a project or area and choose + Meeting to start taking notes.'
            }
            dashedBorder
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mt-6" aria-label={group.label}>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{group.label}</h2>
            <ul className="space-y-1">
              {group.meetings.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/meetings/${m.id}`}
                    className="flex items-center gap-3 min-h-[52px] px-3 py-2 rounded-control border border-border bg-surface hover:bg-surface-2"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium text-text">{m.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {m.item_title} · {formatMeetingTime(m.held_at)}
                        {m.item_archived ? ' · archived' : ''}
                      </span>
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
          </section>
        ))
      )}
    </div>
  )
}
