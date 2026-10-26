import { describe, it, expect } from 'vitest'
import { apiClient } from '../api/client'

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
