import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Card, CardLink } from '../components/common/Card'

describe('Card', () => {
  it('renders children inside a div', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeTruthy()
  })

  it('has bg-surface class', () => {
    const { container } = render(<Card>X</Card>)
    expect(container.firstChild).toHaveClass('bg-surface')
  })

  it('has rounded-card class', () => {
    const { container } = render(<Card>X</Card>)
    expect(container.firstChild).toHaveClass('rounded-card')
  })

  it('has border class', () => {
    const { container } = render(<Card>X</Card>)
    expect(container.firstChild).toHaveClass('border')
  })

  it('accepts additional className', () => {
    const { container } = render(<Card className="extra">X</Card>)
    expect(container.firstChild).toHaveClass('extra')
  })
})

describe('CardLink', () => {
  it('renders as an anchor element', () => {
    render(
      <MemoryRouter>
        <CardLink to="/test">Link card</CardLink>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Link card' })).toBeTruthy()
  })

  it('has href pointing to the to prop', () => {
    render(
      <MemoryRouter>
        <CardLink to="/projects">Projects</CardLink>
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: 'Projects' })
    expect(link.getAttribute('href')).toBe('/projects')
  })

  it('has bg-surface class', () => {
    render(
      <MemoryRouter>
        <CardLink to="/">X</CardLink>
      </MemoryRouter>
    )
    expect(screen.getByRole('link').className).toContain('bg-surface')
  })
})
