/**
 * Weekly Review, old steps: next steps can be added from the Projects step, Someday tasks and empty projects are
 * handled, and the Resources step does not leave the review.
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

const PROJECT: ReviewProjectItem = {
  id: 1, title: 'Project A', description: '', task_count: 2, open_task_count: 1, completed_task_count: 1,
  progress_percentage: 50, project_deadline: null, project_status: 'active', days_since_update: 5, is_stale: false,
  updated_at: '2026-10-23T10:00:00Z',
}
const RESOURCE: ReviewResourceItem = {
  id: 10, title: 'Style guide', description: '', days_since_update: 10, is_stale: false, updated_at: '2026-10-18T10:00:00Z',
}

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: 1, title, description: '', notes: '', due_date: null, priority: 'medium', is_complete: false,
    sort_order: 0, created_at: '', updated_at: '', subtask_count: 0, completed_subtask_count: 0, tags: [],
    focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false, meeting_id: null,
    meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

const state = vi.hoisted(() => ({
  tasks: [] as unknown[],
  tasksLoading: false,
  createTask: vi.fn(),
  archive: vi.fn(),
  completeProject: vi.fn(),
}))

vi.mock('../hooks/useReview', () => ({
  useReviewProjects: () => ({ data: [PROJECT], isLoading: false }),
  useReviewResources: () => ({ data: [RESOURCE], isLoading: false }),
  reviewKeys: { all: ['wr'] },
}))
vi.mock('../hooks/useTasks', () => ({
  useCompleteTask: () => ({ mutateAsync: vi.fn() }),
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
  useCreateTask: () => ({ mutateAsync: state.createTask, isPending: false }),
  useItemTasks: () => ({ data: state.tasks, isLoading: state.tasksLoading }),
  taskKeys: { all: ['tasks'] },
}))
vi.mock('../hooks/useItems', () => ({
  useCompleteProject: () => ({ mutateAsync: state.completeProject }),
  useArchiveItem: () => ({ mutateAsync: state.archive }),
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

function renderProjects(onTaskAdded = vi.fn()) {
  render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={vi.fn()} onTaskAdded={onTaskAdded} />, { wrapper })
  return onTaskAdded
}

beforeEach(() => {
  vi.clearAllMocks()
  state.tasks = [task(1, 'Open task')]
  state.tasksLoading = false
  state.createTask.mockResolvedValue({})
  state.archive.mockResolvedValue({})
  state.completeProject.mockResolvedValue({})
})

describe('ProjectsStep — next steps', () => {
  it('adds a next step to the project being reviewed and counts it', async () => {
    const user = userEvent.setup()
    const onTaskAdded = renderProjects()
    const field = screen.getByRole('textbox', { name: 'Add a next step to Project A' }) as HTMLInputElement
    await user.type(field, '  Call the vendor  {Enter}')
    expect(state.createTask).toHaveBeenCalledWith({ title: 'Call the vendor', item_id: 1 })
    await waitFor(() => expect(field.value).toBe(''))
    expect(onTaskAdded).toHaveBeenCalledTimes(1)
  })

  it('keeps the text and does not count when adding fails', async () => {
    const user = userEvent.setup()
    state.createTask.mockRejectedValue(new Error('offline'))
    const onTaskAdded = renderProjects()
    const field = screen.getByRole('textbox', { name: /Add a next step/ }) as HTMLInputElement
    await user.type(field, 'Keep me{Enter}')
    await waitFor(() => expect(state.createTask).toHaveBeenCalled())
    expect(field.value).toBe('Keep me')
    expect(onTaskAdded).not.toHaveBeenCalled()
  })

  it('a blank step is not added and the Add button stays off', async () => {
    const user = userEvent.setup()
    renderProjects()
    expect((screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByRole('textbox', { name: /Add a next step/ }), '   {Enter}')
    expect(state.createTask).not.toHaveBeenCalled()
  })

  it('warns when the project has nothing open, but not while the tasks are still loading', () => {
    state.tasks = []
    state.tasksLoading = true
    renderProjects()
    expect(screen.queryByText(/No open tasks/)).toBeNull()
  })

  it('warns when the project has nothing open', () => {
    state.tasks = []
    renderProjects()
    expect(screen.getByText(/No open tasks\. Add a next step/)).toBeTruthy()
  })

  it('leaves Someday ideas out of the list (they have their own step) and so does not count them as open', () => {
    state.tasks = [task(1, 'Real task'), task(2, 'Parked idea', { is_someday: true })]
    renderProjects()
    expect(screen.getByText('Real task')).toBeTruthy()
    expect(screen.queryByText('Parked idea')).toBeNull()
  })

  it('a project with only Someday tasks counts as having nothing open', () => {
    state.tasks = [task(2, 'Parked idea', { is_someday: true })]
    renderProjects()
    expect(screen.getByText(/No open tasks\. Add a next step/)).toBeTruthy()
  })

  it('a failed archive or complete leaves the project on screen without an unhandled error', async () => {
    const user = userEvent.setup()
    state.archive.mockRejectedValue(new Error('offline'))
    state.completeProject.mockRejectedValue(new Error('offline'))
    const onArchived = vi.fn()
    render(<ProjectsStep onCompleted={vi.fn()} onUpdatedDueDate={vi.fn()} onArchived={onArchived} onTaskAdded={vi.fn()} />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Archive project' }))
    await user.click(screen.getByRole('button', { name: 'Mark project complete' }))
    await waitFor(() => expect(state.completeProject).toHaveBeenCalled())
    expect(onArchived).not.toHaveBeenCalled()
    expect(screen.getByText('Project A')).toBeTruthy()
  })
})

describe('ResourcesStep', () => {
  it('"Update" opens the resource in a new tab so the review keeps its place', () => {
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    const link = screen.getByRole('link', { name: /Update/ })
    expect(link.getAttribute('href')).toBe('/resources/10')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('a failed archive leaves the buttons in place', async () => {
    const user = userEvent.setup()
    state.archive.mockRejectedValue(new Error('offline'))
    render(<ResourcesStep onArchived={vi.fn()} />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(state.archive).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
  })
})
