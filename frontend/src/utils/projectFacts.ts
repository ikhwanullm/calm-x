import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { formatRelativeDate, isoToLocalDateStr } from './date'
import { daysSinceActivity, STALE_DAYS } from './projectList'
import type { Project } from '../types/models'

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** "Meeting today 09:00", "Meeting Tue", "Meeting 4 Nov"; else "Last meeting 3 days ago"; null when none. */
export function meetingLabel(p: Project, today: string): string | null {
  const stats = p.stats
  if (!stats) return null
  if (stats.next_meeting_at) {
    const date = isoToLocalDateStr(stats.next_meeting_at)
    const diff = differenceInCalendarDays(parseISO(date), parseISO(today))
    if (diff === 0) return `Meeting today ${format(new Date(stats.next_meeting_at), 'HH:mm')}`
    if (diff > 0 && diff < 7) return `Meeting ${format(parseISO(date), 'EEE')}`
    return `Meeting ${format(parseISO(date), 'd MMM')}`
  }
  if (stats.last_meeting_at) {
    return `Last meeting ${lowerFirst(formatRelativeDate(isoToLocalDateStr(stats.last_meeting_at), today))}`
  }
  return null
}

/** "updated today" / "updated 3 days ago", or "no activity for 45 days" once stale. */
export function activityLabel(p: Project, today: string): { text: string; stale: boolean } | null {
  const days = daysSinceActivity(p, today)
  if (days === null || !p.stats) return null
  if (days >= STALE_DAYS && p.project_status !== 'completed') return { text: `no activity for ${days} days`, stale: true }
  return { text: `updated ${lowerFirst(formatRelativeDate(isoToLocalDateStr(p.stats.last_activity_at), today))}`, stale: false }
}
