import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Kbd } from '../components/common/Kbd'

describe('Kbd', () => {
  it('renders as kbd element', () => {
    const { container } = render(<Kbd>Q</Kbd>)
    expect(container.querySelector('kbd')).toBeTruthy()
  })

  it('renders shortcut text', () => {
    render(<Kbd>Ctrl</Kbd>)
    expect(screen.getByText('Ctrl')).toBeTruthy()
  })

  it('has border class', () => {
    const { container } = render(<Kbd>K</Kbd>)
    expect(container.querySelector('kbd')?.className).toContain('border')
  })

  it('has bg-surface-2 class', () => {
    const { container } = render(<Kbd>K</Kbd>)
    expect(container.querySelector('kbd')?.className).toContain('bg-surface-2')
  })

  it('has text-xs class (12px font)', () => {
    const { container } = render(<Kbd>K</Kbd>)
    expect(container.querySelector('kbd')?.className).toContain('text-xs')
  })
})
