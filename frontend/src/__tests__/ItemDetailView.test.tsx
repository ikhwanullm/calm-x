import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { ItemDetailView } from '../components/items/ItemDetailView'
import { useItem, useUpdateItem } from '../hooks/useItems'

const mockProject = {
  id: 1,
  type: 'project' as const,
  title: 'My Project',
  description: 'A desc',
  notes: '',
  archived_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  project_goal: null,
  project_deadline: null,
  project_status: 'active' as const,
  project_completed_at: null,
  task_count: 0,
  completed_task_count: 0,
  progress_percentage: 0,
}

const mockMutate = vi.fn()

vi.mock('../hooks/useItems', () => ({
  useItem: vi.fn(),
  useUpdateItem: vi.fn(),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ItemDetailView', () => {
  beforeEach(() => {
    vi.mocked(useItem).mockReturnValue({
      data: mockProject,
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useUpdateItem).mockReturnValue({ mutate: mockMutate, isPending: false } as any)
  })

  it('renders item title', () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    // Title appears in breadcrumb and as the title button
    const matches = screen.getAllByText('My Project')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders breadcrumb with list link', () => {
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('link', { name: 'Projects' })).toBeTruthy()
  })

  it('title button is clickable to start editing', async () => {
    const user = userEvent.setup()
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    const titleBtn = screen.getByRole('button', { name: /Edit title/i })
    await user.click(titleBtn)
    expect(screen.getByRole('textbox', { name: 'Item title' })).toBeTruthy()
  })

  it('shows archive notice for archived item', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      data: { ...mockProject, archived_at: '2024-06-01T00:00:00Z' },
      isLoading: false,
      isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByText(/Read-only/i)).toBeTruthy()
  })

  it('shows loading skeleton while fetching', () => {
    vi.mocked(useItem).mockReturnValueOnce({
      isLoading: true,
      data: undefined,
      isError: false,
    } as any)
    render(<ItemDetailView id={1} listPath="/projects" listLabel="Projects" />, { wrapper })
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
