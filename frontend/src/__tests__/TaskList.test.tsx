import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
vi.mock('../hooks/useSettings', () => ({
  useDeadlineThreshold: () => 3,
}))

import { TaskList } from '../components/tasks/TaskList'
import type { Task } from '../types/models'

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: Math.random(),
  item_id: null,
  title: 'Task',
  description: '',
  notes: '',
  due_date: null,
  priority: 'medium',
  is_complete: false,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  subtask_count: 0,
  completed_subtask_count: 0,
  tags: [],
  ...overrides,
})

function renderList(tasks: Task[], props = {}) {
  return render(
    <MemoryRouter>
      <TaskList
        tasks={tasks}
        onOpenDrawer={vi.fn()}
        onToggleComplete={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('TaskList', () => {
  it('renders open tasks', () => {
    renderList([makeTask({ id: 1, title: 'Open task' })])
    expect(screen.getByText('Open task')).toBeTruthy()
  })

  it('renders nothing when empty', () => {
    const { container } = renderList([])
    expect(container.firstChild).toBeNull()
  })

  it('completed tasks are hidden behind "Show N completed" button', () => {
    renderList([
      makeTask({ id: 1, title: 'Open' }),
      makeTask({ id: 2, title: 'Done', is_complete: true }),
    ])
    expect(screen.queryByText('Done')).toBeNull()
    expect(screen.getByText('Show 1 completed')).toBeTruthy()
  })

  it('clicking "Show N completed" reveals completed tasks', async () => {
    const user = userEvent.setup()
    renderList([
      makeTask({ id: 1, title: 'Open' }),
      makeTask({ id: 2, title: 'Done', is_complete: true }),
    ])
    await user.click(screen.getByText('Show 1 completed'))
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('has aria-live region for drag announcements', () => {
    renderList([makeTask({ id: 1 })])
    expect(document.querySelector('[aria-live="assertive"]')).toBeTruthy()
  })

  it('has role=list for accessibility', () => {
    renderList([makeTask({ id: 1 })])
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0)
  })
})
