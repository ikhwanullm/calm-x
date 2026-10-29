import { describe, it, expect } from 'vitest'
import { addDays, isValidDate, isWeekend, mondayOf, weekRangeLabel } from '../utils/week'
import { moveTaskInWeek } from '../hooks/useCalendar'
import type { CalendarWeek, Task } from '../types/models'

describe('week utils', () => {
  it('finds the Monday of any day, Sunday included', () => {
    expect(mondayOf('2026-10-29')).toBe('2026-10-26')
    expect(mondayOf('2026-10-26')).toBe('2026-10-26')
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-10-26', 7)).toBe('2026-11-02')
    expect(addDays('2026-11-02', -7)).toBe('2026-10-26')
  })

  it('validates dates', () => {
    expect(isValidDate('2026-10-29')).toBe(true)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('nope')).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })

  it('labels a week, with the start year only when it crosses New Year', () => {
    expect(weekRangeLabel('2026-10-26')).toBe('26 Oct – 1 Nov 2026')
    expect(weekRangeLabel('2026-12-28')).toBe('28 Dec 2026 – 3 Jan 2027')
  })

  it('knows weekends', () => {
    expect(isWeekend('2026-10-31')).toBe(true)
    expect(isWeekend('2026-11-01')).toBe(true)
    expect(isWeekend('2026-10-30')).toBe(false)
  })
})

describe('moveTaskInWeek', () => {
  const t = (id: number, due: string | null): Task => ({ id, title: `T${id}`, due_date: due } as Task)
  const week: CalendarWeek = {
    days: ['2026-10-29', '2026-10-30', '2026-10-31'].map((date) => ({
      date, meetings: [], due: [], planned: [], deadlines: [], starts: [],
    })),
  }
  week.days[0].due = [t(1, '2026-10-29')]
  week.days[0].planned = [t(2, null)]
  week.days[1].starts = [t(3, null)]

  it('takes the task out of its old list and puts it in the target day due list with the new date', () => {
    const moved = moveTaskInWeek(week, t(1, '2026-10-29'), '2026-10-31')
    expect(moved.days[0].due).toEqual([])
    expect(moved.days[2].due.map((x) => [x.id, x.due_date])).toEqual([[1, '2026-10-31']])
  })

  it('moves planned and starts entries too', () => {
    expect(moveTaskInWeek(week, t(2, null), '2026-10-30').days[0].planned).toEqual([])
    expect(moveTaskInWeek(week, t(3, null), '2026-10-31').days[1].starts).toEqual([])
  })

  it('does not change the original', () => {
    moveTaskInWeek(week, t(1, '2026-10-29'), '2026-10-31')
    expect(week.days[0].due).toHaveLength(1)
  })
})
