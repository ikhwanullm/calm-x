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

  it('renders nothing when isComplete=true for approaching', () => {
    const { container } = render(
      <StatusBadge status="approaching" date="2025-01-01" isComplete={true} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders overdue badge with correct aria-label', () => {
    render(<StatusBadge status="overdue" date="2025-01-01" />)
    expect(screen.getByRole('status', { name: 'overdue' })).toBeTruthy()
  })

  it('renders approaching badge with correct aria-label', () => {
    render(<StatusBadge status="approaching" date="2025-06-01" />)
    expect(screen.getByRole('status', { name: 'approaching deadline' })).toBeTruthy()
  })

  it('renders on-track badge with correct aria-label', () => {
    render(<StatusBadge status="on-track" date="2025-12-01" />)
    expect(screen.getByRole('status', { name: 'on track' })).toBeTruthy()
  })

  it('overdue badge has danger colors', () => {
    render(<StatusBadge status="overdue" date="2025-01-01" />)
    const badge = screen.getByRole('status')
    expect(badge.className).toContain('bg-danger-bg')
    expect(badge.className).toContain('text-danger-fg')
  })

  it('approaching badge has warn colors', () => {
    render(<StatusBadge status="approaching" date="2025-01-01" />)
    const badge = screen.getByRole('status')
    expect(badge.className).toContain('bg-warn-bg')
    expect(badge.className).toContain('text-warn-fg')
  })

  it('on-track badge has ok colors', () => {
    render(<StatusBadge status="on-track" date="2025-01-01" />)
    const badge = screen.getByRole('status')
    expect(badge.className).toContain('bg-ok-bg')
    expect(badge.className).toContain('text-ok-fg')
  })

  it('renders a time element with the date', () => {
    render(<StatusBadge status="overdue" date="2025-03-15" />)
    const time = document.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe('2025-03-15')
  })

  it('defaults isComplete to false (renders badge)', () => {
    render(<StatusBadge status="on-track" date="2025-01-01" />)
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
