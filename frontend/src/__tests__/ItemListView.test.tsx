import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ItemListView } from '../components/items/ItemListView'

vi.mock('../hooks/useItems', () => ({
  useItems: vi.fn().mockReturnValue({ data: [], isLoading: false, isError: false }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('ItemListView', () => {
  it('renders page title', () => {
    render(
      <ItemListView
        type="project"
        title="Projects"
        emptyTitle="No projects"
        emptyDescription="Add one."
        newItemLabel="New project"
        onNew={() => {}}
        basePath="/projects"
      />,
      { wrapper }
    )
    expect(screen.getByText('Projects')).toBeTruthy()
  })

  it('shows empty state when no items', () => {
    render(
      <ItemListView
        type="project"
        title="Projects"
        emptyTitle="No projects yet"
        emptyDescription="Create your first."
        newItemLabel="New project"
        onNew={() => {}}
        basePath="/projects"
      />,
      { wrapper }
    )
    expect(screen.getByText('No projects yet')).toBeTruthy()
  })

  it('shows loading skeleton while fetching', async () => {
    const { useItems } = await import('../hooks/useItems')
    vi.mocked(useItems).mockReturnValueOnce({ isLoading: true, data: undefined, isError: false } as ReturnType<typeof useItems>)
    render(
      <ItemListView
        type="project"
        title="Projects"
        emptyTitle="No projects"
        emptyDescription="Add one."
        newItemLabel="New project"
        onNew={() => {}}
        basePath="/projects"
      />,
      { wrapper }
    )
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
