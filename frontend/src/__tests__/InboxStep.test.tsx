/**
 * InboxStep tests — focusing on the single-source-of-truth bug fix.
 * All actions must operate on the DISPLAYED (active) task, not on a stale reference.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InboxStep } from '../components/review/InboxStep'
import type { ReviewTaskItem } from '../api/review'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const TASK_A: ReviewTaskItem = { id: 1, title: 'Task A', description: '', priority: 'medium', created_at: '2026-10-20T10:00:00Z' }
const TASK_B: ReviewTaskItem = { id: 2, title: 'Task B', description: '', priority: 'low', created_at: '2026-10-21T10:00:00Z' }
const TASK_C: ReviewTaskItem = { id: 3, title: 'Task C', description: '', priority: 'high', created_at: '2026-10-22T10:00:00Z' }

const mockMoveTask = vi.fn().mockResolvedValue({})
const mockCompleteTask = vi.fn().mockResolvedValue({})
const mockDeleteTask = vi.fn().mockResolvedValue({})

const mockUseReviewInbox = vi.fn()

vi.mock('../hooks/useReview', () => ({
  useReviewInbox: () => mockUseReviewInbox(),
  reviewKeys: {
    inbox: () => ['weekly-review', 'inbox'],
  },
}))

const itemsData = vi.hoisted(() => ({
  projects: [{ id: 10, title: 'My Project', type: 'project' }] as Record<string, unknown>[],
}))

vi.mock('../hooks/useItems', () => ({
  useItems: (filter: { type: string }) => ({
    data: filter.type === 'project'
      ? itemsData.projects
      : [{ id: 20, title: 'My Area', type: 'area' }],
  }),
  itemKeys: { all: ['items'] },
}))

vi.mock('../hooks/useTasks', () => ({
  useMoveTask: () => ({ mutateAsync: mockMoveTask, isPending: false }),
  useCompleteTask: () => ({ mutateAsync: mockCompleteTask, isPending: false }),
  useDeleteTask: () => ({ mutateAsync: mockDeleteTask, isPending: false }),
  taskKeys: { all: ['tasks'], inbox: () => ['tasks', 'inbox'] },
}))

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

function renderStep(tasks: ReviewTaskItem[] = [TASK_A, TASK_B, TASK_C]) {
  mockUseReviewInbox.mockReturnValue({ data: tasks, isLoading: false })
  return render(
    <InboxStep onOrganized={vi.fn()} onCompleted={vi.fn()} onDeleted={vi.fn()} />,
    { wrapper }
  )
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('InboxStep — basic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows first task on load', () => {
    renderStep()
    expect(screen.getByText('Task A')).toBeTruthy()
  })

  it('shows Task 1 of 3 counter', () => {
    renderStep()
    expect(screen.getByText('Task 1 of 3')).toBeTruthy()
  })

  it('shows empty state when inbox is empty', () => {
    renderStep([])
    expect(screen.getByText(/Inbox is empty/i)).toBeTruthy()
  })

  it('has Move to project and Move to area buttons', () => {
    renderStep()
    expect(screen.getByRole('button', { name: /move to project/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /move to area/i })).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// CRITICAL: Skip must not change which task actions operate on
// ---------------------------------------------------------------------------

describe('InboxStep — Skip bug fix (single source of truth)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Skip advances the counter from Task 1 to Task 2', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B, TASK_C])
    expect(screen.getByText('Task 1 of 3')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /skip/i }))
    expect(screen.getByText('Task 2 of 3')).toBeTruthy()
  })

  it('Skip → displayed task changes to Task B', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B, TASK_C])
    expect(screen.getByText('Task A')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => expect(screen.getByText('Task B')).toBeTruthy())
  })

  it('Skip → P moves Task B (the displayed task), not Task A', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B, TASK_C])

    // Skip Task A → display shows Task B
    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => screen.getByText('Task B'))

    // Move to project — should move Task B (id=2), not Task A (id=1)
    await user.click(screen.getByRole('button', { name: /move to project/i }))
    await waitFor(() => expect(mockMoveTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: TASK_B.id })
    ))
    // Task A must NOT have been moved
    expect(mockMoveTask).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: TASK_A.id })
    )
  })

  it('Skip → C completes Task B (the displayed task), not Task A', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B, TASK_C])

    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => screen.getByText('Task B'))

    await user.click(screen.getByRole('button', { name: /mark complete/i }))
    await waitFor(() => expect(mockCompleteTask).toHaveBeenCalledWith(TASK_B.id))
    expect(mockCompleteTask).not.toHaveBeenCalledWith(TASK_A.id)
  })

  it('Skip → D dialog mentions Task B (the displayed task)', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B, TASK_C])

    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => screen.getByText('Task B'))

    await user.click(screen.getByRole('button', { name: /^delete/i }))
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy())
    // Dialog description must name Task B, not Task A
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Task B')
    expect(dialog.textContent).not.toContain('Task A')
  })

  it('Skip → D → confirm deletes Task B, not Task A', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B, TASK_C])

    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => screen.getByText('Task B'))

    await user.click(screen.getByRole('button', { name: /^delete/i }))
    await waitFor(() => screen.getByRole('alertdialog'))
    await user.click(screen.getByRole('button', { name: /delete task/i }))

    await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith(TASK_B.id))
    expect(mockDeleteTask).not.toHaveBeenCalledWith(TASK_A.id)
  })

  it('Skip all tasks cycles back to Task A', async () => {
    const user = userEvent.setup()
    renderStep([TASK_A, TASK_B])

    // Skip Task A → shows Task B
    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => screen.getByText('Task B'))

    // Skip Task B → back to Task A
    await user.click(screen.getByRole('button', { name: /skip/i }))
    await waitFor(() => screen.getByText('Task A'))
  })

  it('Skip is disabled when only one task remains', async () => {
    renderStep([TASK_A])
    const skipBtn = screen.getByRole('button', { name: /skip/i })
    expect(skipBtn).toHaveProperty('disabled', true)
  })
})

// ---------------------------------------------------------------------------
// P/A feedback when no selection
// ---------------------------------------------------------------------------

describe('InboxStep — P/A button state', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Move to project button is enabled when a project is selected', () => {
    renderStep([TASK_A])
    // The mock returns one project (id=10), button should be enabled
    const projectBtn = screen.getByRole('button', { name: /move to project/i })
    expect(projectBtn).toHaveProperty('disabled', false)
  })

  it('Move to area button is enabled when an area is selected', () => {
    renderStep([TASK_A])
    const areaBtn = screen.getByRole('button', { name: /move to area/i })
    expect(areaBtn).toHaveProperty('disabled', false)
  })
})

// ---------------------------------------------------------------------------
// One action at a time, and no filing into a finished project
// ---------------------------------------------------------------------------

describe('InboxStep — safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    itemsData.projects = [{ id: 10, title: 'My Project', type: 'project' }]
  })

  it('a second click while the first is still saving does not act twice', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    mockCompleteTask.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    renderStep([TASK_A, TASK_B])
    const complete = screen.getByRole('button', { name: /mark complete/i })
    await user.click(complete)
    await user.click(complete)
    expect(mockCompleteTask).toHaveBeenCalledTimes(1)
    expect(mockCompleteTask).toHaveBeenCalledWith(TASK_A.id)
    finish()
    await waitFor(() => screen.getByText('Task B'))
    mockCompleteTask.mockResolvedValue({})
  })

  it('a failed save keeps the task on screen and allows another try', async () => {
    const user = userEvent.setup()
    mockCompleteTask.mockRejectedValueOnce(new Error('offline'))
    renderStep([TASK_A, TASK_B])
    await user.click(screen.getByRole('button', { name: /mark complete/i }))
    await waitFor(() => expect(mockCompleteTask).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Task A')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /mark complete/i }))
    await waitFor(() => expect(mockCompleteTask).toHaveBeenCalledTimes(2))
    await waitFor(() => screen.getByText('Task B'))
  })

  it('does not offer a completed project as a destination', () => {
    itemsData.projects = [
      { id: 10, title: 'My Project', type: 'project', project_status: 'active' },
      { id: 11, title: 'Finished Project', type: 'project', project_status: 'completed' },
    ]
    renderStep([TASK_A])
    const select = screen.getByLabelText('Select project to move task to')
    expect(within(select).getByRole('option', { name: 'My Project' })).toBeTruthy()
    expect(within(select).queryByRole('option', { name: 'Finished Project' })).toBeNull()
  })
})
