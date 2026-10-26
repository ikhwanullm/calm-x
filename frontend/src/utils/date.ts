import {
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns'

/**
 * Return today's date as YYYY-MM-DD string in the client's local timezone.
 */
export function getLocalToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Format a YYYY-MM-DD date string into a human-readable absolute date.
 * Used for <time title="..."> tooltips.
 * Example: "Thu, 29 Oct 2026"
 */
export function formatAbsoluteDate(dateStr: string): string {
  const d = parseISO(dateStr)
  return format(d, 'EEE, d MMM yyyy')
}

/**
 * Format a YYYY-MM-DD date string relative to today (ui-guidelines §7).
 * Always uses the client's local date as "today".
 */
export function formatRelativeDate(dateStr: string, today?: string): string {
  const todayStr = today ?? getLocalToday()
  const d = parseISO(dateStr)
  const t = parseISO(todayStr)
  const diff = differenceInCalendarDays(d, t)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff >= 2 && diff <= 90) return `In ${diff} days`
  if (diff <= -2 && diff >= -90) return `${Math.abs(diff)} days ago`

  // Beyond ±90 days: absolute short date
  const currentYear = t.getFullYear()
  const dateYear = d.getFullYear()
  return dateYear === currentYear
    ? format(d, 'd MMM')       // "17 Dec"
    : format(d, 'd MMM yyyy')  // "17 Dec 2024"
}
