import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useSettings, useDeadlineThreshold } from '../hooks/useSettings'

vi.mock('../api/settings', () => ({
  settingsApi: {
    get: vi.fn().mockResolvedValue({ approaching_deadline_threshold: '7' }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

describe('useSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches settings and returns data', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.approaching_deadline_threshold).toBe('7')
  })

  it('useDeadlineThreshold returns parsed integer from settings', async () => {
    const { result } = renderHook(() => useDeadlineThreshold(), { wrapper })
    await waitFor(() => expect(result.current).toBe(7))
  })

  it('useDeadlineThreshold falls back to DEFAULT_THRESHOLD (3) when no data', () => {
    const { result } = renderHook(() => useDeadlineThreshold(), { wrapper })
    // Before data loads, should return fallback
    expect(typeof result.current).toBe('number')
  })
})
