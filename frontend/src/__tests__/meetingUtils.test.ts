import { describe, it, expect } from 'vitest'
import {
  actionsLabel, defaultMeetingTitle, groupByWeek, joinLocalDateTime, MEETING_TEMPLATE, splitLocalDateTime,
} from '../utils/meeting'
import type { MeetingSummary } from '../types/models'

function meeting(id: number, held_at: string): MeetingSummary {
  return {
    id, item_id: 1, item_title: 'P', item_type: 'project', item_archived: false, title: `M${id}`,
    held_at, attendees: '', processed_at: null, updated_at: held_at, open_action_count: 0,
  }
}

describe('meeting utils', () => {
  it('template has the five sections and one example action line', () => {
    expect(MEETING_TEMPLATE.match(/^## /gm)).toHaveLength(5)
    expect(['Agenda', 'Notes', 'Decisions', 'Actions', 'Questions'].every((h) => MEETING_TEMPLATE.includes(`## ${h}`))).toBe(true)
    expect(MEETING_TEMPLATE).toContain('- [ ] ')
  })

  it('default title is "{item} meeting" and stays within 200 characters', () => {
    expect(defaultMeetingTitle('Migrate CML')).toBe('Migrate CML meeting')
    expect(defaultMeetingTitle('x'.repeat(500)).length).toBeLessThanOrEqual(200)
  })

  it('date and time inputs round-trip through ISO', () => {
    const iso = '2026-10-28T03:15:00.000Z'
    const { date, time } = splitLocalDateTime(iso)
    expect(joinLocalDateTime(date, time)).toBe(iso)
  })

  it('joining needs both parts', () => {
    expect(joinLocalDateTime('', '10:00')).toBeNull()
    expect(joinLocalDateTime('2026-10-28', '')).toBeNull()
  })

  it('groups meetings by Monday-start week, keeping order', () => {
    const groups = groupByWeek([
      meeting(1, '2026-10-29T08:00:00'),   // Thursday
      meeting(2, '2026-10-27T08:00:00'),   // Tuesday, same week
      meeting(3, '2026-10-26T08:00:00'),   // Monday, same week
      meeting(4, '2026-10-25T08:00:00'),   // Sunday, previous week
    ])
    expect(groups.map((g) => g.meetings.map((m) => m.id))).toEqual([[1, 2, 3], [4]])
    expect(groups[0].label).toBe('Week of 26 Oct 2026')
    expect(groups[1].label).toBe('Week of 19 Oct 2026')
  })

  it('pluralises the action label', () => {
    expect(actionsLabel(1)).toBe('1 action to process')
    expect(actionsLabel(3)).toBe('3 actions to process')
  })
})
