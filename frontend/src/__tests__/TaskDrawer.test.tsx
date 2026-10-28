import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDrawer } from '../components/tasks/TaskDrawer'
import { useTask } from '../hooks/useTasks'
import { getLocalToday } from '../utils/date'
import type { Task, Subtask } from '../types/models'

// ── Fixtures ──────────────────────────────────────────────────────────────────────────

const baseTask: Task = {
  id: 1,
  item_id: null,
  title: 'Finish the report',
  description: 'Write section 3',
  notes: '',
  due_date: '2099-12-31',
  priority: 'high',
  is_complete: false,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  subtask_count: 2,
  completed_subtask_count: 1,
  tags: [],
  focus_date: null, waiting_for: null, waiting_since: null, item_title: null, item_type: null,
}

const subtasks: Subtask[] = [
  { id: 10, task_id: 1, title: 'Sub A', is_complete: true, sort_order: 0, created_at: '', updated_at: '' },
  { id: 11, task_id: 1, title: 'Sub B', is_complete: false, sort_order: 1, created_at: '', updated_at: '' },
]

// ── Mocks ───────────────────────────────────────────────────────────────────────────

const mockMutate = vi.fn()

vi.mock('../hooks/useTasks', () => ({
  useTask: vi.fn(() => ({ data: baseTask, isLoading: false })),
  useUpdateTask: vi.fn(() => ({ mutate: mockMutate, isPending: false })),
  useDeleteTask: vi.fn(() => ({ mutate: mockMutate })),
  useCompleteTask: vi.fn(() => ({ mutate: mockMutate })),
  useIncompleteTask: vi.fn(() => ({ mutate: mockMutate })),
  useMoveTask: vi.fn(() => ({ mutate: mockMutate })),
}))

vi.mock('../hooks/useSubtasks', () => ({
  useSubtasks: vi.fn(() => ({ data: subtasks })),
  useCreateSubtask: vi.fn(() => ({ mutate: mockMutate })),
  useCompleteSubtask: vi.fn(() => ({ mutate: mockMutate })),
  useIncompleteSubtask: vi.fn(() => ({ mutate: mockMutate })),
  useDeleteSubtask: vi.fn(() => ({ mutate: mockMutate })),
}))

vi.mock('../hooks/useItems', () => ({
  useItems: vi.fn(() => ({ data: [] })),
}))

vi.mock('../hooks/useTags', () => ({
  useTags: vi.fn(() => ({ data: [] })),
  useCreateTag: vi.fn(() => ({ mutate: mockMutate })),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────────────

function renderDrawer(taskId: number | null, onClose = vi.fn()) {
  return render(<TaskDrawer taskId={taskId} onClose={onClose} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────────────

describe('TaskDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing (closed sheet) when taskId is null', () => {
    renderDrawer(null)
    // Sheet is closed — title should not be in the document
    expect(screen.queryByText('Finish the report')).toBeNull()
  })

  it('renders task title when open with taskId=1', () => {
    renderDrawer(1)
    expect(screen.getByText('Finish the report')).toBeTruthy()
  })

  it('has a priority select with the task priority pre-selected', () => {
    renderDrawer(1)
    const select = screen.getByRole('combobox', { name: /priority/i })
    expect(select).toBeTruthy()
    expect((select as HTMLSelectElement).value).toBe('high')
  })

  it('has a "Delete task" button', () => {
    renderDrawer(1)
    expect(screen.getByRole('button', { name: /delete task/i })).toBeTruthy()
  })

  it('has a completion checkbox with aria-label', () => {
    renderDrawer(1)
    expect(screen.getByLabelText('Mark complete: Finish the report')).toBeTruthy()
  })

  it('has a close button', () => {
    renderDrawer(1)
    expect(screen.getByRole('button', { name: /close task details/i })).toBeTruthy()
  })

  it('clicking close button calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderDrawer(1, onClose)
    await user.click(screen.getByRole('button', { name: /close task details/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders subtask list items', () => {
    renderDrawer(1)
    expect(screen.getByText('Sub A')).toBeTruthy()
    expect(screen.getByText('Sub B')).toBeTruthy()
  })

  it('renders "Add subtask" button', () => {
    renderDrawer(1)
    expect(screen.getByText('Add subtask')).toBeTruthy()
  })

  it('clicking "Add subtask" shows input form', async () => {
    const user = userEvent.setup()
    renderDrawer(1)
    await user.click(screen.getByText('Add subtask'))
    expect(screen.getByRole('textbox', { name: /new subtask title/i })).toBeTruthy()
  })

  it('clicking "Delete task" opens confirm dialog', async () => {
    const user = userEvent.setup()
    renderDrawer(1)
    await user.click(screen.getByRole('button', { name: /delete task/i }))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('shows progress bar when there are subtasks', () => {
    renderDrawer(1)
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('test_move_to_select_renders: "Move to…" select is present in the footer', () => {
    renderDrawer(1)
    expect(screen.getByLabelText('Move task to')).toBeTruthy()
    expect(screen.getByText('Move to…')).toBeTruthy()
  })

  it('test_tags_section_renders: "Tags" heading is present in the body', () => {
    renderDrawer(1)
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeTruthy()
  })

  it('add tag input is present in TagsSection', () => {
    renderDrawer(1)
    // input[list] has implicit ARIA role combobox
    expect(screen.getByLabelText(/add tag/i)).toBeTruthy()
  })

  it('typing a tag name and pressing Enter calls updateTask.mutate with tag_names', async () => {
    const user = userEvent.setup()
    renderDrawer(1)
    const input = screen.getByLabelText(/add tag/i)
    await user.type(input, 'design')
    await user.keyboard('{Enter}')
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ tag_names: expect.arrayContaining(['design']) })
    )
  })

  it('"Add to Today" puts the task on the local date', async () => {
    const user = userEvent.setup()
    renderDrawer(1)
    await user.click(screen.getByRole('button', { name: /add to today/i }))
    expect(mockMutate).toHaveBeenCalledWith({ focus_date: getLocalToday() })
  })

  it('a task on Today can be removed from it', async () => {
    const user = userEvent.setup()
    vi.mocked(useTask).mockReturnValue({ data: { ...baseTask, focus_date: '2026-10-28' }, isLoading: false } as unknown as ReturnType<typeof useTask>)
    renderDrawer(1)
    expect(screen.getByText('On Today')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /remove from today/i }))
    expect(mockMutate).toHaveBeenCalledWith({ focus_date: null })
    vi.mocked(useTask).mockReturnValue({ data: baseTask, isLoading: false } as unknown as ReturnType<typeof useTask>)
  })

  it('saves "Waiting for" when the field loses focus', async () => {
    const user = userEvent.setup()
    renderDrawer(1)
    await user.type(screen.getByLabelText('Waiting for'), 'Security team')
    await user.tab()
    expect(mockMutate).toHaveBeenCalledWith({ waiting_for: 'Security team' })
  })

  it('does not save "Waiting for" when nothing changed', async () => {
    const user = userEvent.setup()
    renderDrawer(1)
    await user.click(screen.getByLabelText('Waiting for'))
    await user.tab()
    expect(mockMutate).not.toHaveBeenCalledWith(expect.objectContaining({ waiting_for: expect.anything() }))
  })

  it('clears "Waiting for"', async () => {
    const user = userEvent.setup()
    vi.mocked(useTask).mockReturnValue({
      data: { ...baseTask, waiting_for: 'Vendor', waiting_since: '2026-10-26T03:00:00Z' }, isLoading: false,
    } as unknown as ReturnType<typeof useTask>)
    renderDrawer(1)
    expect(screen.getByText(/Waiting since/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(mockMutate).toHaveBeenCalledWith({ waiting_for: null })
    vi.mocked(useTask).mockReturnValue({ data: baseTask, isLoading: false } as unknown as ReturnType<typeof useTask>)
  })
})
