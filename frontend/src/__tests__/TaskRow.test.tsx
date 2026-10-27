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
