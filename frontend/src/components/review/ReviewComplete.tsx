import { Link } from 'react-router-dom'
import { isoToLocalDateStr, formatAbsoluteDate, getLocalToday } from '@/utils/date'

interface ReviewCompleteProps {
  completedAt: string | null
}

export function ReviewComplete({ completedAt }: ReviewCompleteProps) {
  const localDate = completedAt ? isoToLocalDateStr(completedAt) : null
  const absDate = localDate ? formatAbsoluteDate(localDate) : ''
  const isToday = localDate === getLocalToday()

  return (
    <section
      role="status"
      className="flex flex-col items-center gap-3 py-14 px-8 text-center border border-border rounded-2xl bg-surface shadow-[var(--shadow)]"
    >
      <span className="w-14 h-14 rounded-full bg-ok-bg text-ok-fg inline-flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text" style={{ letterSpacing: '-0.02em' }}>
        Review complete
      </h1>
      {localDate && (
        <p className="text-muted max-w-sm">
          Recorded on{' '}
          <time dateTime={localDate} title={absDate}>
            {isToday ? 'today' : absDate}
          </time>
          . Your system is clear for the week ahead.
        </p>
      )}
      <Link
        to="/"
        className="mt-2 inline-flex items-center h-11 px-5 rounded-control bg-accent text-accent-fg text-sm font-semibold hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </section>
  )
}
