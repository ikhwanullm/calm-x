import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagChip } from '../components/common/TagChip'

describe('TagChip', () => {
  it('renders tag with # prefix', () => {
    render(<TagChip name="design" />)
    expect(screen.getByText('#design')).toBeTruthy()
  })

  it('renders different tag names', () => {
    render(<TagChip name="work" />)
    expect(screen.getByText('#work')).toBeTruthy()
  })

  it('has bg-surface-2 class', () => {
    const { container } = render(<TagChip name="test" />)
    expect(container.firstChild).toHaveClass('bg-surface-2')
  })

  it('has text-xs class', () => {
    const { container } = render(<TagChip name="test" />)
    expect(container.firstChild).toHaveClass('text-xs')
  })

  it('accepts additional className', () => {
    const { container } = render(<TagChip name="test" className="extra" />)
    expect(container.firstChild).toHaveClass('extra')
  })
})
