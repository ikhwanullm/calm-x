import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { greetingForHour, useGreeting } from '../hooks/useGreeting'

describe('greetingForHour', () => {
  it.each([
    [0, 'Good morning'], [11, 'Good morning'],
    [12, 'Good afternoon'], [16, 'Good afternoon'],
    [17, 'Good evening'], [23, 'Good evening'],
  ])('hour %i is "%s"', (hour, text) => {
    expect(greetingForHour(hour)).toBe(text)
  })
})

describe('useGreeting', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('changes after 5 minutes when the hour passes, and when the window regains focus', () => {
    vi.setSystemTime(new Date(2026, 10, 3, 16, 58))
    const { result } = renderHook(() => useGreeting())
    expect(result.current).toBe('Good afternoon')

    act(() => { vi.advanceTimersByTime(5 * 60 * 1000) })
    expect(result.current).toBe('Good evening')

    vi.setSystemTime(new Date(2026, 10, 4, 8, 0))
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(result.current).toBe('Good morning')
  })
})
