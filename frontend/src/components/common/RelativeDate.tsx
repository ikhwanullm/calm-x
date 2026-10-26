import { formatRelativeDate, formatAbsoluteDate } from '@/utils/date'

export interface RelativeDateProps {
  /** ISO date string YYYY-MM-DD */
  date: string
  /** Override "today" for testing — defaults to client's local today */
  today?: string
}

/**
 * Renders a <time> element with:
 *   - datetime="YYYY-MM-DD"
 *   - title="Thu, 29 Oct 2026"  (absolute date on hover)
 *   - text: relative label per ui-guidelines §7
 * Styled with a dotted underline.
 */
export function RelativeDate({ date, today }: RelativeDateProps) {
  const label = formatRelativeDate(date, today)
  const title = formatAbsoluteDate(date)

  return (
    <time
      dateTime={date}
      title={title}
      className="underline decoration-dotted cursor-default"
    >
      {label}
    </time>
  )
}
