import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getDeadlineStatus } from '../utils/deadline'
import { getLocalToday } from '../utils/date'

const today = getLocalToday()

// Guard against fast-check emitting new Date(NaN) even with min/max bounds
const validDate = (min: Date, max: Date) =>
  fc.date({ min, max }).filter((d) => !isNaN(d.getTime()))

describe('P15: Deadline Status Badge Correctness', () => {
  it('completed tasks always return null', () => {
    fc.assert(fc.property(
      validDate(new Date('2020-01-01'), new Date('2099-12-31')),
      (d) => {
        const dateStr = d.toISOString().slice(0, 10)
        return getDeadlineStatus(dateStr, true, 3, today) === null
      }
    ))
  })

  it('overdue: past due dates (not complete) -> overdue', () => {
    expect(getDeadlineStatus('2020-01-01', false, 3, '2025-06-01')).toBe('overdue')
  })

  it('approaching: 0-threshold days -> approaching', () => {
    expect(getDeadlineStatus('2025-06-04', false, 3, '2025-06-01')).toBe('approaching')
  })

  it('on-track: beyond threshold days -> on-track', () => {
    expect(getDeadlineStatus('2025-06-10', false, 3, '2025-06-01')).toBe('on-track')
  })

  it('never returns invalid status string', () => {
    fc.assert(fc.property(
      validDate(new Date('2024-01-01'), new Date('2027-12-31')),
      fc.integer({ min: 1, max: 30 }),
      (d, threshold) => {
        const dateStr = d.toISOString().slice(0, 10)
        const status = getDeadlineStatus(dateStr, false, threshold, today)
        return status === null || ['overdue', 'approaching', 'on-track'].includes(status)
      }
    ))
  })
})
