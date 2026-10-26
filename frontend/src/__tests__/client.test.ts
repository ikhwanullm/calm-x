import { describe, it, expect } from 'vitest'
import { apiClient, extractApiError } from '../api/client'

describe('API client', () => {
  it('has baseURL set to /api', () => {
    expect(apiClient.defaults.baseURL).toBe('/api')
  })

  it('sends X-Calm-X: 1 header by default', () => {
    const headers = apiClient.defaults.headers
    // axios stores common headers under 'common' or at top level
    const xCalmX =
      (headers as Record<string, unknown>)['X-Calm-X'] ??
      (headers.common as Record<string, unknown> | undefined)?.['X-Calm-X']
    expect(xCalmX).toBe('1')
  })

  it('has Content-Type application/json', () => {
    const headers = apiClient.defaults.headers
    const ct =
      (headers as Record<string, unknown>)['Content-Type'] ??
      (headers.common as Record<string, unknown> | undefined)?.['Content-Type']
    expect(String(ct)).toContain('application/json')
  })
})

describe('extractApiError helper', () => {
  it('returns message from plain Error', () => {
    const result = extractApiError(new Error('Something went wrong'))
    expect(result.message).toBe('Something went wrong')
    expect(result.type).toBe('unknown_error')
  })

  it('returns message for unknown type', () => {
    const result = extractApiError('string error')
    expect(result.type).toBe('unknown_error')
  })
})
