import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityChip } from '../components/common/PriorityChip'

describe('PriorityChip', () => {
  it('renders "High" for high priority', () => {
    render(<PriorityChip priority="high" />)
    expect(screen.getByText('High')).toBeTruthy()
  })

  it('renders "Medium" for medium priority', () => {
    render(<PriorityChip priority="medium" />)
    expect(screen.getByText('Medium')).toBeTruthy()
  })

  it('renders "Low" for low priority', () => {
    render(<PriorityChip priority="low" />)
    expect(screen.getByText('Low')).toBeTruthy()
  })

  it('has bg-surface-2 class (neutral, no status colors)', () => {
    const { container } = render(<PriorityChip priority="high" />)
    expect(container.firstChild).toHaveClass('bg-surface-2')
  })

  it('does not use danger/warn/ok colors', () => {
    const { container } = render(<PriorityChip priority="high" />)
    const cls = (container.firstChild as Element).className
    expect(cls).not.toContain('danger')
    expect(cls).not.toContain('warn')
    expect(cls).not.toContain('ok-')
  })
})
