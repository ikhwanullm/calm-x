import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../components/common/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy()
  })

  it('default variant has bg-accent class', () => {
    render(<Button variant="primary">P</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-accent')
  })

  it('secondary variant has border class', () => {
    render(<Button variant="secondary">S</Button>)
    expect(screen.getByRole('button').className).toContain('border')
  })

  it('ghost variant has text-accent-text class', () => {
    render(<Button variant="ghost">G</Button>)
    expect(screen.getByRole('button').className).toContain('text-accent-text')
  })

  it('danger variant has text-danger-fg class', () => {
    render(<Button variant="danger">D</Button>)
    expect(screen.getByRole('button').className).toContain('text-danger-fg')
  })

  it('default size has h-11 class', () => {
    render(<Button size="default">X</Button>)
    expect(screen.getByRole('button').className).toContain('h-11')
  })

  it('sm size has h-9 class', () => {
    render(<Button size="sm">X</Button>)
    expect(screen.getByRole('button').className).toContain('h-9')
  })

  it('forwards disabled prop', () => {
    render(<Button disabled>Dis</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('icon-only button requires aria-label (accessibility)', () => {
    render(<Button iconOnly aria-label="Close dialog">X</Button>)
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy()
  })

  it('accepts additional className', () => {
    render(<Button className="custom-class">X</Button>)
    expect(screen.getByRole('button').className).toContain('custom-class')
  })

  it('has type=button by default', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('type can be overridden to submit', () => {
    render(<Button type="submit">X</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('icon-only default size has w-11 class', () => {
    render(<Button iconOnly size="default" aria-label="Action">X</Button>)
    expect(screen.getByRole('button').className).toContain('w-11')
  })

  it('icon-only sm size has w-9 class', () => {
    render(<Button iconOnly size="sm" aria-label="Action">X</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('w-9')
    expect(cls).not.toContain('w-11')
  })
})
