import { addDays as addDaysFns, format, isValid, parseISO, startOfWeek } from 'date-fns'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

/** Monday (YYYY-MM-DD) of the week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  return fmt(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }))
}

export function addDays(dateStr: string, n: number): string {
  return fmt(addDaysFns(parseISO(dateStr), n))
}

/** True for a well-formed YYYY-MM-DD that exists on the calendar. */
export function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = parseISO(value)
  return isValid(d) && fmt(d) === value
}

/** "26 Oct – 1 Nov 2026" for the week starting at `start`. */
export function weekRangeLabel(start: string): string {
  const a = parseISO(start)
  const b = addDaysFns(a, 6)
  const left = a.getFullYear() === b.getFullYear() ? format(a, 'd MMM') : format(a, 'd MMM yyyy')
  return `${left} – ${format(b, 'd MMM yyyy')}`
}

export function isWeekend(dateStr: string): boolean {
  const day = parseISO(dateStr).getDay()
  return day === 0 || day === 6
}

/** "Mon" */
export const weekdayShort = (dateStr: string) => format(parseISO(dateStr), 'EEE')
/** "26" */
export const dayOfMonth = (dateStr: string) => format(parseISO(dateStr), 'd')
/** "Fri 30 Oct" */
export const dayLabel = (dateStr: string) => format(parseISO(dateStr), 'EEE d MMM')
/** "10:00" in the local timezone */
export const meetingTime = (iso: string) => format(new Date(iso), 'HH:mm')
