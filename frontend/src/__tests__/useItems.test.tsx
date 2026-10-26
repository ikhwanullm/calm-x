import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { itemKeys } from '../hooks/useItems'

// Mock the API module
vi.mock('../api/items', () => ({
  itemsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 1, type: 'project', title: 'P1', task_count: 0, completed_task_count: 0, progress_percentage: 0 }
    ]),
    get: vi.fn().mockResolvedValue(
      { id: 1, type: 'project', title: 'P1', task_count: 0, completed_task_count: 0, progress_percentage: 0 }
    ),
    create: vi.fn().mockResolvedValue({ id: 2, type: 'area', title: 'New' }),
    update: vi.fn().mockResolvedValue({ id: 1, type: 'project', title: 'Updated' }),
    delete: vi.fn().mockResolvedValue({}),
    archive: vi.fn().mockResolvedValue({ id: 1, archived_at: '2024-01-01T00:00:00Z' }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('itemKeys', () => {
  it('all returns base key', () => {
    expect(itemKeys.all).toEqual(['items'])
  })

  it('list returns scoped key', () => {
    expect(itemKeys.list({ type: 'project' })).toEqual(['items', 'list', { type: 'project' }])
  })

  it('detail returns id-scoped key', () => {
    expect(itemKeys.detail(42)).toEqual(['items', 'detail', 42])
  })
})

describe('useItems hook', () => {
  it('fetches items list', async () => {
    const { useItems } = await import('../hooks/useItems')
    const { result } = renderHook(() => useItems(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

describe('useItem hook', () => {
  it('fetches single item', async () => {
    const { useItem } = await import('../hooks/useItems')
    const { result } = renderHook(() => useItem(1), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.title).toBe('P1')
  })

  it('is disabled when id <= 0', async () => {
    const { useItem } = await import('../hooks/useItems')
    const { result } = renderHook(() => useItem(0), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
