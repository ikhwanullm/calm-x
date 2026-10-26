import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Skeleton } from '../components/common/Skeleton'

describe('Skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is NOT visible before 200ms', () => {
    render(<Skeleton />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('IS visible after 200ms', () => {
    render(<Skeleton />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('has aria-label="Loading"', () => {
    render(<Skeleton />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByLabelText('Loading')).toBeTruthy()
  })

  it('has aria-busy=true', () => {
    render(<Skeleton />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
  })

  it('has animate-pulse class', () => {
    render(<Skeleton />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByRole('status').className).toContain('animate-pulse')
  })

  it('has bg-surface-2 class', () => {
    render(<Skeleton />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByRole('status').className).toContain('bg-surface-2')
  })

  it('applies custom className', () => {
    render(<Skeleton className="w-32 h-4" />)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    const el = screen.getByRole('status')
    expect(el.className).toContain('w-32')
    expect(el.className).toContain('h-4')
  })

  it('shows immediately when delay=0', () => {
    render(<Skeleton delay={0} />)
    // No timer advance needed
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
