import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../components/common/StatusBadge'

describe('StatusBadge', () => {
  it('renders nothing when isComplete=true', () => {
    const { container } = render(
      <StatusBadge status="overdue" date="2025-01-01" isComplete />
    )
    expect(container.firstChild).toBeNull()
  })

  it('has no role=status', () => {
    render(<StatusBadge status="overdue" date="2025-01-01" />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('overdue has aria-label starting with overdue:', () => {
    render(<StatusBadge status="overdue" date={'2026-11-01'} today="2026-10-29" />)
    expect(screen.getByLabelText(/overdue:/)).toBeTruthy()
  })

  it('approaching has aria-label with prefix', () => {
    render(<StatusBadge status="approaching" date={'2026-11-01'} today="2026-10-29" />)
    expect(screen.getByLabelText(/approaching deadline:/)).toBeTruthy()
  })

  it('aria-label includes relative date lowercase', () => {
    render(<StatusBadge status="approaching" date="2026-11-01" today="2026-10-29" />)
    const el = screen.getByLabelText(/approaching deadline:/)
    const label = el.getAttribute('aria-label') ?? ''
    expect(label).toContain('in 3 days')
    expect(label).toContain('Nov')
  })

  it('overdue has danger colors', () => {
    const { container } = render(<StatusBadge status="overdue" date="2025-01-01" />)
    const badge = container.firstChild as Element
    expect(badge.className).toContain('bg-danger-bg')
    expect(badge.className).toContain('text-danger-fg')
  })

  it('approaching has warn colors', () => {
    const { container } = render(<StatusBadge status="approaching" date="2025-01-01" />)
    const badge = container.firstChild as Element
    expect(badge.className).toContain('bg-warn-bg')
  })

  it('on-track has ok colors', () => {
    const { container } = render(<StatusBadge status="on-track" date="2025-01-01" />)
    const badge = container.firstChild as Element
    expect(badge.className).toContain('bg-ok-bg')
  })

  it('renders time element with dateTime', () => {
    render(<StatusBadge status="overdue" date="2025-03-15" />)
    const time = document.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe('2025-03-15')
  })

  it('defaults isComplete to false', () => {
    const { container } = render(<StatusBadge status="on-track" date="2025-01-01" />)
    expect(container.firstChild).toBeTruthy()
  })
})
