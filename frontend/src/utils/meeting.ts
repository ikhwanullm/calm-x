import { format, startOfWeek } from 'date-fns'
import type { MeetingCarryOver, MeetingSummary } from '../types/models'

/** Body of a new meeting (`[ ]`, `@Who:`, `?` and `!` lines are picked up by the server). */
export const MEETING_TEMPLATE = [
  '## Agenda',
  '',
  '## Notes',
  '',
  '## Decisions',
  '',
  '## Actions',
  '- [ ] ',
  '',
  '## Questions',
  '',
].join('\n')

/**
 * Body of a new meeting that follows another one: a "From last meeting" block (the previous meeting's
 * `?` questions as `?` lines, and its still-open tasks as plain bullets) above the template.
 * Without anything to carry over it is just the template.
 */
export function buildMeetingBody(carry: MeetingCarryOver | null): string {
  if (!carry || (carry.questions.length === 0 && carry.open_tasks.length === 0)) return MEETING_TEMPLATE
  const lines = ['## From last meeting', '', `[${carry.title}](/meetings/${carry.meeting_id}) · ${formatMeetingTime(carry.held_at)}`, '']
  if (carry.questions.length > 0) {
    lines.push('Still unanswered:', '', ...carry.questions.map((q) => `? ${q}`), '')
  }
  if (carry.open_tasks.length > 0) {
    lines.push(
      'Tasks still open:',
      '',
      ...carry.open_tasks.map((t) => `- Task: ${t.title}${t.waiting_for ? ` (waiting for ${t.waiting_for})` : ''}`),
      ''
    )
  }
  return `${lines.join('\n')}\n${MEETING_TEMPLATE}`
}

/** Title of a new meeting: "{item title} meeting", within the 200-char limit. */
export function defaultMeetingTitle(itemTitle: string): string {
  return `${itemTitle.slice(0, 190).trim()} meeting`
}

/** ISO datetime (UTC) -> local `YYYY-MM-DD` and `HH:mm` for the date and time inputs. */
export function splitLocalDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') }
}

/** Local date + time input values -> ISO datetime (UTC). Returns null while either is empty or invalid. */
export function joinLocalDateTime(date: string, time: string): string | null {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** "Mon, 26 Oct 2026, 10:00" in the local timezone. */
export function formatMeetingTime(iso: string): string {
  return format(new Date(iso), 'EEE, d MMM yyyy, HH:mm')
}

/** Meetings grouped by week (Monday start), keeping the incoming newest-first order. */
export function groupByWeek(meetings: MeetingSummary[]): { label: string; meetings: MeetingSummary[] }[] {
  const groups: { key: string; label: string; meetings: MeetingSummary[] }[] = []
  for (const meeting of meetings) {
    const monday = startOfWeek(new Date(meeting.held_at), { weekStartsOn: 1 })
    const key = format(monday, 'yyyy-MM-dd')
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label: `Week of ${format(monday, 'd MMM yyyy')}`, meetings: [] }
      groups.push(group)
    }
    group.meetings.push(meeting)
  }
  return groups
}

export function actionsLabel(count: number): string {
  return `${count} ${count === 1 ? 'action' : 'actions'} to process`
}
