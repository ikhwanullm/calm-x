import { describe, it, expect } from 'vitest'
import { queryClient } from '../lib/queryClient'
import { QueryClient } from '@tanstack/react-query'

describe('QueryClient', () => {
  it('is a QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient)
  })

  it('has staleTime set to 30 seconds', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(30_000)
  })

  it('has retry set to 1 for queries', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.retry).toBe(1)
  })

  it('has retry set to 0 for mutations', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.mutations?.retry).toBe(0)
  })
})
