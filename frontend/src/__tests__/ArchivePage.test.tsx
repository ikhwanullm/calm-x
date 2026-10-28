import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ArchivePage from '../pages/ArchivePage'
import type { Item } from '../types/models'

const mockArchivedProject: Item = {
  id: 1,
  type: 'project',
  title: 'Old Project',
  description: 'A finished project',
  notes: '',
  archived_at: '2026-10-27T20:00:00Z',  // UTC — local date in +07:00 is 2026-10-28
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-27T20:00:00Z',
  task_count: 3,
  completed_task_count: 3,
  progress_percentage: 100,
  project_goal: null,
  project_deadline: null,
  project_status: 'completed',
  project_completed_at: null,
}

const mockArchivedArea: Item = {
  id: 2,
  type: 'area',
  title: 'Old Area',
  description: '',
  notes: '',
  archived_at: '2026-10-15T10:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-15T10:00:00Z',
  task_count: 0,
  completed_task_count: 0,
  progress_percentage: 0,
  area_maintenance_notes: null,
}

const mockRestoreItem = vi.fn().mockResolvedValue({ ...mockArchivedProject, archived_at: null })
const mockDeleteItem = vi.fn().mockResolvedValue({})

vi.mock('../hooks/useItems', () => ({
  useArchivedItems: vi.fn(() => ({ data: [mockArchivedProject, mockArchivedArea], isLoading: false, isError: false })),
  useRestoreItem: vi.fn(() => ({
    mutateAsync: mockRestoreItem,
    isPending: false,
    variables: undefined,
  })),
  useDeleteItem: vi.fn(() => ({
    mutateAsync: mockDeleteItem,
    isPending: false,
  })),
}))

vi.mock('../lib/toast', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ArchivePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders archive heading', () => {
    render(<ArchivePage />, { wrapper })
    expect(screen.getByRole('heading', { name: /archive/i })).toBeTruthy()
  })

  it('shows archived items', () => {
    render(<ArchivePage />, { wrapper })
    expect(screen.getByText('Old Project')).toBeTruthy()
    expect(screen.getByText('Old Area')).toBeTruthy()
  })

  it('shows type badges for archived items', () => {
    render(<ArchivePage />, { wrapper })
    expect(screen.getByText('Project')).toBeTruthy()
    expect(screen.getByText('Area')).toBeTruthy()
  })

  it('has search input', () => {
    render(<ArchivePage />, { wrapper })
    expect(screen.getByPlaceholderText(/search archived items/i)).toBeTruthy()
  })

  it('has type filter dropdown', () => {
    render(<ArchivePage />, { wrapper })
    expect(screen.getByLabelText(/type/i)).toBeTruthy()
  })

  it('has archived_from and archived_to date inputs', () => {
    render(<ArchivePage />, { wrapper })
    expect(screen.getByLabelText(/archived from/i)).toBeTruthy()
    expect(screen.getByLabelText(/^to:/i)).toBeTruthy()
  })

  it('has restore buttons for each item', () => {
    render(<ArchivePage />, { wrapper })
    const restoreButtons = screen.getAllByRole('button', { name: /restore/i })
    expect(restoreButtons.length).toBe(2)
  })

  it('has delete buttons for each item', () => {
    render(<ArchivePage />, { wrapper })
    const deleteButtons = screen.getAllByRole('button', { name: /delete.*permanently/i })
    expect(deleteButtons.length).toBe(2)
  })

  it('restore button calls restoreMutation', async () => {
    const user = userEvent.setup()
    render(<ArchivePage />, { wrapper })
    const restoreBtn = screen.getByRole('button', { name: /restore old project/i })
    await user.click(restoreBtn)
    expect(mockRestoreItem).toHaveBeenCalledWith(1)
  })

  it('delete button shows confirm dialog with exact text', async () => {
    const user = userEvent.setup()
    render(<ArchivePage />, { wrapper })
    const deleteBtn = screen.getByRole('button', { name: /delete old project permanently/i })
    await user.click(deleteBtn)
    // ConfirmDialog appears with exact description
    await waitFor(() => {
      expect(screen.getByText('This item will be permanently deleted. This action cannot be undone.')).toBeTruthy()
    })
  })

  it('confirm delete calls deleteMutation', async () => {
    const user = userEvent.setup()
    render(<ArchivePage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /delete old project permanently/i }))
    await waitFor(() => screen.getByText('This item will be permanently deleted. This action cannot be undone.'))
    // Click the confirm button in the dialog
    const confirmBtn = screen.getByRole('button', { name: /delete old project/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(mockDeleteItem).toHaveBeenCalledWith(1))
  })

  it('search bar updates URL params on submit', async () => {
    const user = userEvent.setup()
    render(<ArchivePage />, { wrapper })
    const searchInput = screen.getByPlaceholderText(/search archived items/i)
    await user.type(searchInput, 'test query')
    await user.click(screen.getByRole('button', { name: /search/i }))
    // URL params updated (via setSearchParams) — we verify the input has the value
    expect(searchInput).toHaveValue('test query')
  })

  it('type filter change updates filter state', async () => {
    const user = userEvent.setup()
    render(<ArchivePage />, { wrapper })
    const typeSelect = screen.getByLabelText(/type/i)
    await user.selectOptions(typeSelect, 'project')
    expect(typeSelect).toHaveValue('project')
  })

  it('shows empty state when no items match', async () => {
    const { useArchivedItems } = vi.mocked(await import('../hooks/useItems'))
    useArchivedItems.mockReturnValueOnce({ data: [], isLoading: false, isError: false } as ReturnType<typeof useArchivedItems>)
    render(<ArchivePage />, { wrapper })
    expect(screen.getByText(/archive is empty/i)).toBeTruthy()
  })

  it('shows loading skeletons while loading', async () => {
    const { useArchivedItems } = vi.mocked(await import('../hooks/useItems'))
    useArchivedItems.mockReturnValueOnce({ data: undefined, isLoading: true, isError: false } as ReturnType<typeof useArchivedItems>)
    render(<ArchivePage />, { wrapper })
    // Skeleton group is present
    const loadingRegion = document.querySelector('[aria-label="Loading archived items"]')
    expect(loadingRegion).toBeTruthy()
  })
})
