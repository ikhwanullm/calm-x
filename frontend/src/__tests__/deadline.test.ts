import { describe, it, expect } from 'vitest'
import { getDeadlineStatus } from '../utils/deadline'

const today = '2025-10-15'

describe('getDeadlineStatus', () => {
  it('returns null for completed items', () => {
    expect(getDeadlineStatus('2025-10-10', true, 3, today)).toBeNull()
  })

  it('returns "overdue" when deadline is in the past', () => {
    expect(getDeadlineStatus('2025-10-14', false, 3, today)).toBe('overdue')
  })

  it('returns "approaching" when deadline is within threshold', () => {
    expect(getDeadlineStatus('2025-10-17', false, 3, today)).toBe('approaching')
  })

  it('returns "approaching" on the deadline day', () => {
    expect(getDeadlineStatus('2025-10-15', false, 3, today)).toBe('approaching')
  })

  it('returns "on-track" when more than threshold days away', () => {
    expect(getDeadlineStatus('2025-10-19', false, 3, today)).toBe('on-track')
  })

  it('uses custom threshold', () => {
    expect(getDeadlineStatus('2025-10-20', false, 10, today)).toBe('approaching')
    expect(getDeadlineStatus('2025-10-26', false, 10, today)).toBe('on-track')
  })
})
