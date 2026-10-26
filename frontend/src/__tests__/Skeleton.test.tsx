import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Skeleton, SkeletonGroup } from '../components/common/Skeleton'

describe('Skeleton', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('reserves space before delay (visibility:hidden)', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as Element
    expect(el).toBeTruthy()
    expect(el.className).toContain('invisible')
  })

  it('becomes visible after 200ms', () => {
    const { container } = render(<Skeleton />)
    act(() => { vi.advanceTimersByTime(200) })
    const el = container.firstChild as Element
    expect(el.className).not.toContain('invisible')
  })

  it('has no role=status (moved to SkeletonGroup)', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelector('status')).toBeNull()
  })

  it('has animate-pulse and bg-surface-2', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as Element
    expect(el.className).toContain('animate-pulse')
    expect(el.className).toContain('bg-surface-2')
  })

  it('shows immediately with delay=0', () => {
    const { container } = render(<Skeleton delay={0} />)
    const el = container.firstChild as Element
    expect(el.className).not.toContain('invisible')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="w-32 h-4" delay={0} />)
    const el = container.firstChild as Element
    expect(el.className).toContain('w-32')
    expect(el.className).toContain('h-4')
  })
})

describe('SkeletonGroup', () => {
  it('has role=status', () => {
    render(<SkeletonGroup><div /></SkeletonGroup>)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('has aria-label=Loading by default', () => {
    render(<SkeletonGroup><div /></SkeletonGroup>)
    expect(screen.getByLabelText('Loading')).toBeTruthy()
  })

  it('accepts custom label', () => {
    render(<SkeletonGroup label="Loading projects"><div /></SkeletonGroup>)
    expect(screen.getByLabelText('Loading projects')).toBeTruthy()
  })
})
