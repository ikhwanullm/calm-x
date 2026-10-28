/**
 * Tests for project deadline: create with deadline (Fix 1) and
 * inline edit in detail view (Fix 2).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Project } from '../types/models'
import { NewItemDialog } from '../components/items/NewItemDialog'
import { ItemDetailView } from '../components/items/ItemDetailView'
import {
  useItem,
  useUpdateItem,
  useCompleteProject,
  useReopenProject,
  useArchiveItem,
  useRestoreItem,
  useDeleteItem,
  useCreateItem,
} from '../hooks/useItems'
import {
  useItemTasks,
  useCreateTask,
  useCompleteTask,
  useIncompleteTask,
} from '../hooks/useTasks'

// ---------------------------------------------------------------------------
// All vi.mock calls (hoisted — must appear before any module-level code)
// ---------------------------------------------------------------------------

vi.mock('../hooks/useItems', () => ({
  useItem: vi.fn(),
  useUpdateItem: vi.fn(),
  useCompleteProject: vi.fn(),
  useReopenProject: vi.fn(),
  useArchiveItem: vi.fn(),
  useRestoreItem: vi.fn(),
  useDeleteItem: vi.fn(),
  useCreateItem: vi.fn(),
  itemKeys: { all: ['items'], list: () => [], detail: (id: number) => ['items', 'detail', id] },
}))

vi.mock('../hooks/useTasks', () => ({
  useItemTasks: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCreateTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useCompleteTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  useIncompleteTask: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  taskKeys: { all: ['tasks'], forItem: (id: number) => ['tasks', 'item', id] },
}))

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({ data: null, isLoading: false }),
  useInvalidateDashboard: () => () => {},
  dashboardKeys: { all: ['dashboard'] },
}))

vi.mock('../hooks/useTemplates', () => ({
  useTemplates: () => ({ data: [] }),
  useTemplate: () => ({ data: undefined }),
  useCreateProjectFromTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useLinks', () => ({
  useReferenceLinks: vi.fn(() => ({ data: [] })),
  useAddReferenceLink: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteReferenceLink: vi.fn(() => ({ mutate: vi.fn() })),
  useReorderReferenceLinks: vi.fn(() => ({ mutate: vi.fn() })),
  useLinkedItems: vi.fn(() => ({ data: [] })),
  useLinkResource: vi.fn(() => ({ mutate: vi.fn() })),
  useUnlinkResource: vi.fn(() => ({ mutate: vi.fn() })),
  useConvertItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  linkKeys: { forItem: (id: number) => ['links', id] },
}))

vi.mock('../components/tasks/TaskList', () => ({ TaskList: () => null }))
vi.mock('../components/tasks/TaskDrawer', () => ({ TaskDrawer: () => null }))
vi.mock('../components/items/TypeConversionDialog', () => ({ TypeConversionDialog: () => null }))
vi.mock('../components/items/ReferenceLinksSection', () => ({ ReferenceLinksSection: () => null }))
vi.mock('../components/items/ResourceLinksSection', () => ({ ResourceLinksSection: () => null }))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

// ---------------------------------------------------------------------------
// Test data + shared mocks
// ---------------------------------------------------------------------------

const baseProject: Project = {
  id: 1, type: 'project', title: 'Test Project',
  description: '', notes: '', archived_at: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-28T00:00:00Z',
  task_count: 0, completed_task_count: 0, progress_percentage: 0,
  project_goal: null, project_deadline: null,
  project_status: 'active', project_completed_at: null,
}

const noop = vi.fn()
const mockCreateItem = vi.fn().mockResolvedValue({ id: 99, type: 'project', title: 'Test' })

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <MemoryRouter><QueryClientProvider client={qc}>{children}</QueryClientProvider></MemoryRouter>
}

function setupProjectMocks(overrides: Partial<Project> = {}) {
  const p = { ...baseProject, ...overrides }
  vi.mocked(useItem).mockReturnValue({ data: p, isLoading: false, isError: false } as unknown as ReturnType<typeof useItem>)
  vi.mocked(useUpdateItem).mockReturnValue({ mutate: noop, mutateAsync: noop, isPending: false } as unknown as ReturnType<typeof useUpdateItem>)
  vi.mocked(useCompleteProject).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useCompleteProject>)
  vi.mocked(useReopenProject).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useReopenProject>)
  vi.mocked(useArchiveItem).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useArchiveItem>)
  vi.mocked(useRestoreItem).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useRestoreItem>)
  vi.mocked(useDeleteItem).mockReturnValue({ mutate: noop, isPending: false } as unknown as ReturnType<typeof useDeleteItem>)
  vi.mocked(useItemTasks).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useItemTasks>)
  vi.mocked(useCreateTask).mockReturnValue({ mutate: noop } as unknown as ReturnType<typeof useCreateTask>)
  vi.mocked(useCompleteTask).mockReturnValue({ mutate: noop } as unknown as ReturnType<typeof useCompleteTask>)
  vi.mocked(useIncompleteTask).mockReturnValue({ mutate: noop } as unknown as ReturnType<typeof useIncompleteTask>)
  vi.mocked(useCreateItem).mockReturnValue({ mutateAsync: mockCreateItem, isPending: false } as unknown as ReturnType<typeof useCreateItem>)
}

// ---------------------------------------------------------------------------
// NewItemDialog: Goal and Deadline fields (Fix 1)
// ---------------------------------------------------------------------------

describe('NewItemDialog — Project goal and deadline fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreateItem).mockReturnValue({ mutateAsync: mockCreateItem, isPending: false } as unknown as ReturnType<typeof useCreateItem>)
  })

  it('shows Goal and Deadline fields for Project type', () => {
    render(<NewItemDialog open onOpenChange={vi.fn()} defaultType="project" />, { wrapper })
    expect(screen.getByLabelText(/^project goal$/i)).toBeTruthy()
    expect(screen.getByLabelText(/^project deadline$/i)).toBeTruthy()
  })

  it('no Goal/Deadline fields when Area is selected', () => {
    render(<NewItemDialog open onOpenChange={vi.fn()} defaultType="area" />, { wrapper })
    expect(screen.queryByLabelText(/^project goal$/i)).toBeNull()
    expect(screen.queryByLabelText(/^project deadline$/i)).toBeNull()
  })

  it('creates project with deadline in payload', async () => {
    const user = userEvent.setup()
    render(<NewItemDialog open onOpenChange={vi.fn()} defaultType="project" />, { wrapper })
    await user.type(screen.getByLabelText(/^title/i), 'My Project')
    await user.type(screen.getByLabelText(/^project deadline$/i), '2026-12-31')
    await user.click(screen.getByRole('button', { name: /create project/i }))
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ project_deadline: '2026-12-31' })
    ))
  })

  it('creates project with goal in payload', async () => {
    const user = userEvent.setup()
    render(<NewItemDialog open onOpenChange={vi.fn()} defaultType="project" />, { wrapper })
    await user.type(screen.getByLabelText(/^title/i), 'My Project')
    await user.type(screen.getByLabelText(/^project goal$/i), 'Ship it')
    await user.click(screen.getByRole('button', { name: /create project/i }))
    await waitFor(() => expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ project_goal: 'Ship it' })
    ))
  })
})

// ---------------------------------------------------------------------------
// ItemDetailView: InlineDeadline (Fix 2)
// ---------------------------------------------------------------------------

describe('ItemDetailView — InlineDeadline editor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "+ Add deadline" when project has no deadline', () => {
    setupProjectMocks({ project_deadline: null })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('button', { name: /add deadline/i })).toBeTruthy()
  })

  it('shows "Edit deadline" when project has a deadline', () => {
    setupProjectMocks({ project_deadline: '2099-12-31' })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('button', { name: /edit deadline/i })).toBeTruthy()
  })

  it('clicking "Add deadline" opens date input', async () => {
    const user = userEvent.setup()
    setupProjectMocks({ project_deadline: null })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    await user.click(screen.getByRole('button', { name: /add deadline/i }))
    expect(screen.getByLabelText(/project deadline/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy()
  })

  it('saving new deadline calls updateItem.mutate with date', async () => {
    const user = userEvent.setup()
    setupProjectMocks({ project_deadline: null })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    await user.click(screen.getByRole('button', { name: /add deadline/i }))
    await user.type(screen.getByLabelText(/project deadline/i), '2026-12-31')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(noop).toHaveBeenCalledWith(
      expect.objectContaining({ project_deadline: '2026-12-31' })
    ))
  })

  it('"Clear deadline" button appears when editing an existing deadline', async () => {
    const user = userEvent.setup()
    setupProjectMocks({ project_deadline: '2099-12-31' })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    await user.click(screen.getByRole('button', { name: /edit deadline/i }))
    expect(screen.getByRole('button', { name: /clear deadline/i })).toBeTruthy()
  })

  it('clearing deadline calls updateItem.mutate with null', async () => {
    const user = userEvent.setup()
    setupProjectMocks({ project_deadline: '2099-12-31' })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    await user.click(screen.getByRole('button', { name: /edit deadline/i }))
    await user.click(screen.getByRole('button', { name: /clear deadline/i }))
    await waitFor(() => expect(noop).toHaveBeenCalledWith(
      expect.objectContaining({ project_deadline: null })
    ))
  })

  it('archived project shows no Add/Edit deadline buttons', () => {
    setupProjectMocks({ project_deadline: null, archived_at: '2026-10-28T10:00:00Z' })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.queryByRole('button', { name: /add deadline/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit deadline/i })).toBeNull()
  })

  it('archived project with a past deadline shows no overdue badge (R7.8)', () => {
    setupProjectMocks({ project_deadline: '2020-01-01', archived_at: '2026-10-28T10:00:00Z' })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.queryByLabelText(/^overdue:/i)).toBeNull()
  })

  it('active project with a past deadline shows the overdue badge', () => {
    setupProjectMocks({ project_deadline: '2020-01-01' })
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByLabelText(/^overdue:/i)).toBeTruthy()
  })
})
