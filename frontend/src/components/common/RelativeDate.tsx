import { formatRelativeDate, formatAbsoluteDate } from '@/utils/date'

export interface RelativeDateProps {
  /** ISO date string YYYY-MM-DD */
  date: string
  /** Override 'today' for testing -- defaults to client's local today */
  today?: string
  /**
   * When true, label starts lowercase for mid-sentence use.
   * Per ui-guidelines §7: 'in 3 days', 'yesterday', 'today'
   */
  inline?: boolean
}


export function RelativeDate({ date, today, inline = false }: RelativeDateProps) {
  const label = formatRelativeDate(date, today)
  const title = formatAbsoluteDate(date)

  const displayLabel = inline
    ? `${label.charAt(0).toLowerCase()}${label.slice(1)}`
    : label

  const ariaLabel = inline
    ? `${displayLabel}, ${title}`
    : `${label}, ${title}`

  return (
    <time
      dateTime={date}
      title={title}
      aria-label={ariaLabel}
      className='underline decoration-dotted cursor-default'
    >
      {displayLabel}
    </time>
  )
}
