import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RelativeDate } from '../components/common/RelativeDate'
import { formatRelativeDate, formatAbsoluteDate, getLocalToday } from '../utils/date'

const today = '2025-10-15'

describe('formatRelativeDate', () => {
  it('returns "Today" for same day', () => {
    expect(formatRelativeDate('2025-10-15', today)).toBe('Today')
  })

  it('returns "Tomorrow" for +1 day', () => {
    expect(formatRelativeDate('2025-10-16', today)).toBe('Tomorrow')
  })

  it('returns "Yesterday" for -1 day', () => {
    expect(formatRelativeDate('2025-10-14', today)).toBe('Yesterday')
  })

  it('returns "In N days" for +2..+90', () => {
    expect(formatRelativeDate('2025-10-17', today)).toBe('In 2 days')
    expect(formatRelativeDate('2026-01-13', today)).toBe('In 90 days')
  })

  it('returns "N days ago" for -2..-90', () => {
    expect(formatRelativeDate('2025-10-13', today)).toBe('2 days ago')
    expect(formatRelativeDate('2025-07-17', today)).toBe('90 days ago')
  })

  it('returns absolute date without year for same year beyond 90 days', () => {
    expect(formatRelativeDate('2025-01-01', today)).toBe('1 Jan')
  })

  it('returns absolute date with year for different year beyond 90 days', () => {
    expect(formatRelativeDate('2024-06-01', today)).toContain('2024')
  })
})

describe('formatAbsoluteDate', () => {
  it('returns formatted date string', () => {
    expect(formatAbsoluteDate('2026-10-29')).toBe('Thu, 29 Oct 2026')
  })
})

describe('getLocalToday', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(getLocalToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('RelativeDate component', () => {
  it('renders time element with dateTime attribute', () => {
    render(<RelativeDate date="2025-10-15" today="2025-10-15" />)
    expect(screen.getByRole('time').getAttribute('dateTime')).toBe('2025-10-15')
  })

  it('renders "Today" for same day', () => {
    render(<RelativeDate date="2025-10-15" today="2025-10-15" />)
    expect(screen.getByText('Today')).toBeTruthy()
  })

  it('renders "Tomorrow" for next day', () => {
    render(<RelativeDate date="2025-10-16" today="2025-10-15" />)
    expect(screen.getByText('Tomorrow')).toBeTruthy()
  })

  it('has title with absolute date', () => {
    render(<RelativeDate date="2026-10-29" today="2025-10-15" />)
    expect(screen.getByRole('time').getAttribute('title')).toBe('Thu, 29 Oct 2026')
  })

  it('has dotted underline class', () => {
    render(<RelativeDate date="2025-10-15" today="2025-10-15" />)
    expect(screen.getByRole('time').className).toContain('decoration-dotted')
  })

  it('has aria-label combining relative and absolute date', () => {
    render(<RelativeDate date="2025-10-16" today="2025-10-15" />)
    const el = screen.getByRole('time')
    expect(el.getAttribute('aria-label')).toMatch(/Tomorrow/)
    expect(el.getAttribute('aria-label')).toMatch(/Oct 2025/)
  })

  it('inline prop lowercases the label', () => {
    render(<RelativeDate date="2025-10-16" today="2025-10-15" inline />)
    expect(screen.getByRole('time').textContent).toBe('tomorrow')
  })

  it('inline prop lowercases aria-label too', () => {
    render(<RelativeDate date="2025-10-16" today="2025-10-15" inline />)
    const label = screen.getByRole('time').getAttribute('aria-label')
    expect(label?.charAt(0)).toBe('t')  // lowercase 'tomorrow'
  })
})
