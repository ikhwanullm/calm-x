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
 * Convert an ISO 8601 datetime string (e.g. "2026-10-27T20:00:00Z") to a
 * YYYY-MM-DD string in the **client's local timezone**.
 *
 * Example: "2026-10-27T20:00:00Z" in timezone +07:00 → "2026-10-28"
 */
export function isoToLocalDateStr(isoDatetime: string): string {
  const d = new Date(isoDatetime)          // JS Date in UTC internally
  const y = d.getFullYear()                // reads local time
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/**
 * Return the client's local UTC offset as ±HH:MM (e.g. "+07:00", "-05:30").
 */
export function getLocalTzOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset()   // getTimezoneOffset is inverted
  const sign = offsetMin >= 0 ? '+' : '-'
  const h = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')
  const m = String(Math.abs(offsetMin) % 60).padStart(2, '0')
  return `${sign}${h}:${m}`
}

/**
 * Convert a local YYYY-MM-DD date string to a start-of-day ISO 8601 datetime
 * string with the local timezone offset, ready to send as a query parameter.
 *
 * Example in +07:00: "2026-10-28" → "2026-10-28T00:00:00+07:00"
 */
export function localDateToStartISO(dateStr: string): string {
  return `${dateStr}T00:00:00${getLocalTzOffset()}`
}

/**
 * Convert a local YYYY-MM-DD date string to an end-of-day ISO 8601 datetime
 * string with the local timezone offset, ready to send as a query parameter.
 *
 * Example in +07:00: "2026-10-28" → "2026-10-28T23:59:59+07:00"
 */
export function localDateToEndISO(dateStr: string): string {
  return `${dateStr}T23:59:59${getLocalTzOffset()}`
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
