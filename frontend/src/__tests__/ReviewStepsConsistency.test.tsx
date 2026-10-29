/**
 * Consistency tests: display task/item matches the target of actions.
 * Verifies ProjectsStep and ResourcesStep have no display-vs-action mismatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectsStep } from '../components/review/ProjectsStep'
import { ResourcesStep } from '../components/review/ResourcesStep'
import type { ReviewProjectItem, ReviewResourceItem } from '../api/review'
import type { Task } from '../types/models'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PROJECT_A: ReviewProjectItem = {
  id: 1, title: 'Project A', description: 'Alpha',
  task_count: 2, open_task_count: 1, completed_task_count: 1, progress_percentage: 50,
  project_deadline: null, project_status: 'active',
  days_since_update: 5, is_stale: false, updated_at: '2026-10-23T10:00:00Z',
}
const PROJECT_B: ReviewProjectItem = {
  id: 2, title: 'Project B', description: 'Beta',
  task_count: 3, open_task_count: 2, completed_task_count: 1, progress_percentage: 33,
  project_deadline: null, project_status: 'active',
  days_since_update: 35, is_stale: true, updated_at: '2026-09-23T10:00:00Z',
}

const RESOURCE_A: ReviewResourceItem = {
  id: 10, title: 'Resource A', description: '',
  days_since_update: 10, is_stale: false, updated_at: '2026-10-18T10:00:00Z',
}
const RESOURCE_B: ReviewResourceItem = {
  id: 11, title: 'Resource B', description: '',
  days_since_update: 45, is_stale: true, updated_at: '2026-09-13T10:00:00Z',
}

const mockCompleteTask = vi.fn().mockResolvedValue({})
const mockDeleteTask = vi.fn().mockResolvedValue({})
const mockUpdateTask = vi.fn().mockResolvedValue({})
const mockCompleteProject = vi.fn().mockResolvedValue({})
const mockArchiveItem = vi.fn().mockResolvedValue({})

const mockItemTasks: Task[] = [
  {
    id: 100, item_id: 1, title: 'Open task for A', description: '', notes: '',
    due_date: null, priority: 'medium', is_complete: false, sort_order: 0,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    subtask_count: 0, completed_subtask_count: 0, tags: [],
    focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false, item_title: null, item_type: null,
  },
]

vi.mock('../hooks/useReview', () => ({
  useReviewProjects: vi.fn(() => ({ data: [PROJECT_A, PROJECT_B], isLoading: false })),
  useReviewResources: vi.fn(() => ({ data: [RESOURCE_A, RESOURCE_B], isLoading: false })),
  reviewKeys: { all: ['wr'] },
}))

vi.mock('../hooks/useTasks', () => ({
  useCompleteTask: () => ({ mutateAsync: mockCompleteTask, isPending: false }),
  useDeleteTask: () => ({ mutateAsync: mockDeleteTask, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: mockUpdateTask, isPending: false }),
  useItemTasks: () => ({ data: mockItemTasks, isLoading: false }),
  taskKeys: { all: ['tasks'] },
}))

vi.mock('../hooks/useItems', () => ({
  useCompleteProject: () => ({ mutateAsync: mockCompleteProject, isPending: false }),
  useArchiveItem: () => ({ mutateAsync: mockArchiveItem, isPending: false }),
  itemKeys: { all: ['items'] },
}))

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// ProjectsStep: Prev/Next navigation consistency
// ---------------------------------------------------------------------------

describe('ProjectsStep — display/action consistency', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows Project A initially', () => {
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} />, { wrapper })
    expect(screen.getByText('Project A')).toBeTruthy()
  })

  it('Next project → shows Project B', async () => {
    const user = userEvent.setup()
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} />, { wrapper })
    await user.click(screen.getByRole('button', { name: /next project/i }))
    await waitFor(() => expect(screen.getByText('Project B')).toBeTruthy())
  })

  it('Project B is stale and shows stale banner', async () => {
    const user = userEvent.setup()
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} />, { wrapper })
    await user.click(screen.getByRole('button', { name: /next project/i }))
    await waitFor(() => screen.getByText('Project B'))
    expect(screen.getByRole('note')).toBeTruthy()  // stale banner
  })

  it('Archive Project A (from Project A view) calls archive with Project A id', async () => {
    const user = userEvent.setup()
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} />, { wrapper })
    // On Project A, click Archive
    const archiveBtns = screen.getAllByRole('button', { name: /archive project/i })
    await user.click(archiveBtns[0])
    await waitFor(() => expect(mockArchiveItem).toHaveBeenCalledWith(PROJECT_A.id))
    expect(mockArchiveItem).not.toHaveBeenCalledWith(PROJECT_B.id)
  })

  it('Navigate to Project B → Mark complete operates on Project B', async () => {
    const user = userEvent.setup()
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} />, { wrapper })
    await user.click(screen.getByRole('button', { name: /next project/i }))
    await waitFor(() => screen.getByText('Project B'))
    await user.click(screen.getByRole('button', { name: /mark project complete/i }))
    await waitFor(() => expect(mockCompleteProject).toHaveBeenCalledWith(PROJECT_B.id))
    expect(mockCompleteProject).not.toHaveBeenCalledWith(PROJECT_A.id)
  })

  it('Previous button disabled on first project', () => {
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} />, { wrapper })
    expect(screen.getByRole('button', { name: /previous/i })).toHaveProperty('disabled', true)
  })
})

// ---------------------------------------------------------------------------
// ResourcesStep: each row's action targets its own resource
// ---------------------------------------------------------------------------

describe('ResourcesStep — display/action consistency', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows all resources', () => {
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    expect(screen.getByText('Resource A')).toBeTruthy()
    expect(screen.getByText('Resource B')).toBeTruthy()
  })

  it('Resource B has Suggest archiving badge (is_stale)', () => {
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    expect(screen.getByText(/Suggest archiving/i)).toBeTruthy()
  })

  it('Archive Resource A only archives Resource A, not Resource B', async () => {
    const user = userEvent.setup()
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    // Each resource row has its own Archive button; click Resource A's
    const archiveBtns = screen.getAllByRole('button', { name: /archive/i })
    // First Archive button belongs to Resource A (first row)
    await user.click(archiveBtns[0])
    await waitFor(() => expect(mockArchiveItem).toHaveBeenCalledWith(RESOURCE_A.id))
    expect(mockArchiveItem).not.toHaveBeenCalledWith(RESOURCE_B.id)
  })

  it('Archive Resource B only archives Resource B', async () => {
    const user = userEvent.setup()
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    const archiveBtns = screen.getAllByRole('button', { name: /archive/i })
    await user.click(archiveBtns[1])
    await waitFor(() => expect(mockArchiveItem).toHaveBeenCalledWith(RESOURCE_B.id))
    expect(mockArchiveItem).not.toHaveBeenCalledWith(RESOURCE_A.id)
  })

  it('Keep Resource A marks it kept (no archive call)', async () => {
    const user = userEvent.setup()
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    const keepBtns = screen.getAllByRole('button', { name: /^keep$/i })
    await user.click(keepBtns[0])
    // Keep is client-side only (no mutation)
    expect(mockArchiveItem).not.toHaveBeenCalled()
    // Row now shows "Kept" status
    await waitFor(() => expect(screen.getByText('Kept')).toBeTruthy())
  })
})
