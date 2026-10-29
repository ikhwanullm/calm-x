import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
vi.mock('../hooks/useSettings', () => ({
  useDeadlineThreshold: () => 3,
}))

import { TaskRow } from '../components/tasks/TaskRow'
import type { TaskRowProps } from '../components/tasks/TaskRow'
import type { Task } from '../types/models'

const baseTask: Task = {
  id: 1,
  item_id: null,
  title: 'Write tests',
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
  focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false, item_title: null, item_type: null,
}

function renderRow(props: Partial<TaskRowProps> = {}) {
  return render(
    <MemoryRouter>
      <TaskRow
        task={baseTask}
        onOpenDrawer={vi.fn()}
        onToggleComplete={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('TaskRow', () => {
  it('marks tasks that are on Today', () => {
    renderRow({ task: { ...baseTask, focus_date: '2026-10-28' } })
    expect(screen.getByRole('img', { name: 'On Today' })).toBeTruthy()
  })

  it('shows who a task is waiting for', () => {
    renderRow({ task: { ...baseTask, waiting_for: 'Vendor' } })
    expect(screen.getByText('Waiting · Vendor')).toBeTruthy()
  })

  it('shows a "Starts" chip and dims a task deferred past today', () => {
    const { container } = renderRow({ task: { ...baseTask, defer_until: '2099-01-05' } })
    expect(screen.getByText(/^Starts /)).toBeTruthy()
    expect(container.firstChild).toHaveClass('opacity-60')
  })

  it('shows no "Starts" chip once the defer date has arrived', () => {
    const { container } = renderRow({ task: { ...baseTask, defer_until: '2020-01-05' } })
    expect(screen.queryByText(/^Starts /)).toBeNull()
    expect(container.firstChild).not.toHaveClass('opacity-60')
  })

  it('shows a "Someday" chip and dims a parked task', () => {
    const { container } = renderRow({ task: { ...baseTask, is_someday: true } })
    expect(screen.getByText('Someday')).toBeTruthy()
    expect(container.firstChild).toHaveClass('opacity-60')
  })

  it('shows the parent item when asked, and Inbox for inbox tasks', () => {
    const { unmount } = renderRow({ task: { ...baseTask, item_title: 'Migrate CML' }, showItem: true })
    expect(screen.getByText('Migrate CML')).toBeTruthy()
    unmount()
    renderRow({ showItem: true })
    expect(screen.getByText('Inbox')).toBeTruthy()
  })

  it('shows the overdue badge for a past due date', () => {
    renderRow({ task: { ...baseTask, due_date: '2020-01-01' } })
    expect(screen.getByLabelText(/^overdue:/i)).toBeTruthy()
  })

  it('hides the due-date badge when showDeadlineStatus is false (archived item, R7.8)', () => {
    renderRow({ task: { ...baseTask, due_date: '2020-01-01' }, showDeadlineStatus: false })
    expect(screen.queryByLabelText(/^overdue:/i)).toBeNull()
  })

  it('renders task title', () => {
    renderRow()
    expect(screen.getByText('Write tests')).toBeTruthy()
  })

  it('checkbox has correct aria-label', () => {
    renderRow()
    expect(screen.getByLabelText('Mark complete: Write tests')).toBeTruthy()
  })

  it('drag handle has correct aria-label', () => {
    renderRow({ isDraggable: true })
    expect(screen.getByLabelText('Reorder Write tests')).toBeTruthy()
  })

  it('clicking title calls onOpenDrawer', async () => {
    const user = userEvent.setup()
    const onOpenDrawer = vi.fn()
    renderRow({ onOpenDrawer })
    await user.click(screen.getByText('Write tests'))
    expect(onOpenDrawer).toHaveBeenCalledWith(1)
  })

  it('toggling checkbox calls onToggleComplete', async () => {
    const user = userEvent.setup()
    const onToggleComplete = vi.fn()
    renderRow({ onToggleComplete })
    await user.click(screen.getByRole('checkbox'))
    expect(onToggleComplete).toHaveBeenCalledWith(baseTask)
  })

  it('completed task title has line-through', () => {
    renderRow({ task: { ...baseTask, is_complete: true } })
    const titleBtn = screen.getByText('Write tests')
    expect(titleBtn.className).toContain('line-through')
  })

  it('shows subtask count when subtasks exist', () => {
    renderRow({ task: { ...baseTask, subtask_count: 4, completed_subtask_count: 2 } })
    expect(screen.getByText('2/4')).toBeTruthy()
  })

  it('shows tag chips', () => {
    renderRow({ task: { ...baseTask, tags: ['design', 'frontend'] } })
    expect(screen.getByText('#design')).toBeTruthy()
    expect(screen.getByText('#frontend')).toBeTruthy()
  })

  it('selected row has accent-soft background class', () => {
    const { container } = renderRow({ isSelected: true })
    expect(container.firstChild).toHaveClass('bg-accent-soft')
  })
})
