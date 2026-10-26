import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '../components/common/ProgressBar'
import { calculateProgress } from '../utils/progress'

describe('calculateProgress', () => {
  it('returns 0 when total is 0', () => {
    expect(calculateProgress(0, 0)).toBe(0)
  })

  it('returns 0% for 0/10', () => {
    expect(calculateProgress(0, 10)).toBe(0)
  })

  it('returns 100% for 10/10', () => {
    expect(calculateProgress(10, 10)).toBe(100)
  })

  it('returns 50% for 5/10', () => {
    expect(calculateProgress(5, 10)).toBe(50)
  })

  it('REGRESSION: 1/8 returns 13 (not 12)', () => {
    expect(calculateProgress(1, 8)).toBe(13)
  })

  it('returns 25% for 1/4', () => {
    expect(calculateProgress(1, 4)).toBe(25)
  })
})

describe('ProgressBar', () => {
  it('renders with role=progressbar', () => {
    render(<ProgressBar completed={3} total={10} label="Task progress" />)
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('has correct aria-valuenow', () => {
    render(<ProgressBar completed={5} total={10} label="Progress" />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
  })

  it('has aria-valuemin=0 and aria-valuemax=100', () => {
    render(<ProgressBar completed={0} total={10} label="Progress" />)
    const pb = screen.getByRole('progressbar')
    expect(pb.getAttribute('aria-valuemin')).toBe('0')
    expect(pb.getAttribute('aria-valuemax')).toBe('100')
  })

  it('has aria-label', () => {
    render(<ProgressBar completed={3} total={10} label="Task progress" />)
    expect(screen.getByRole('progressbar', { name: 'Task progress' })).toBeTruthy()
  })

  it('displays percentage label', () => {
    render(<ProgressBar completed={5} total={10} label="Progress" />)
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('shows 0% when total is 0', () => {
    render(<ProgressBar completed={0} total={0} label="Progress" />)
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('shows 100% for full completion', () => {
    render(<ProgressBar completed={8} total={8} label="Progress" />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('has bg-track class on track', () => {
    render(<ProgressBar completed={5} total={10} label="Progress" />)
    expect(screen.getByRole('progressbar').className).toContain('bg-track')
  })
})
