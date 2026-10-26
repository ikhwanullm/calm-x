import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from '../components/common/EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No tasks yet"
        description="Add your first task to get started."
      />
    )
    expect(screen.getByText('No tasks yet')).toBeTruthy()
    expect(screen.getByText('Add your first task to get started.')).toBeTruthy()
  })

  it('renders action button when action prop provided', () => {
    render(
      <EmptyState
        title="No projects"
        description="Create your first project."
        action={{ label: 'Add project', onClick: () => {} }}
      />
    )
    expect(screen.getByRole('button', { name: 'Add project' })).toBeTruthy()
  })

  it('does not render button when no action provided', () => {
    render(
      <EmptyState title="No tasks" description="Nothing here." />
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('calls action.onClick when button clicked', async () => {
    const user = userEvent.setup()
    let called = false
    render(
      <EmptyState
        title="Empty"
        description="Nothing."
        action={{ label: 'Do it', onClick: () => { called = true } }}
      />
    )
    await user.click(screen.getByRole('button'))
    expect(called).toBe(true)
  })

  it('has dashed border classes when dashedBorder=true', () => {
    const { container } = render(
      <EmptyState
        title="Empty"
        description="Nothing."
        dashedBorder
      />
    )
    expect(container.firstChild).toHaveClass('border-dashed')
  })

  it('has no dashed border by default', () => {
    const { container } = render(
      <EmptyState title="Empty" description="Nothing." />
    )
    expect(container.firstChild).not.toHaveClass('border-dashed')
  })
})
