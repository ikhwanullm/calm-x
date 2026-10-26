import axios, { type AxiosError } from 'axios'

export interface ApiError {
  message: string
  type: string
  fields?: Record<string, string[]>
}

/**
 * Transform an axios error with a server payload into a typed ApiError.
 * Used to surface server validation messages inline in forms.
 */
export function extractApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const data = (err as AxiosError).response?.data as Record<string, unknown> | undefined
    if (data && typeof data.error === 'string') {
      return {
        message: data.error as string,
        type: (data.type as string) ?? 'unknown_error',
        fields: (data.fields as Record<string, string[]>) ?? undefined,
      }
    }
    return {
      message: err.message ?? 'Request failed',
      type: 'network_error',
    }
  }
  return {
    message: err instanceof Error ? err.message : 'Unknown error',
    type: 'unknown_error',
  }
}

/**
 * Axios instance pre-configured for Calm-X API calls.
 * - baseURL: '/api' (proxied to http://127.0.0.1:8080 by Vite dev server)
 * - X-Calm-X: '1' header on every request (required by CSRF middleware)
 *
 * The response error interceptor converts server JSON error payloads
 * into Error objects with .message = server error text, so mutations
 * and error handling code can access it directly from err.message.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'X-Calm-X': '1',
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

// Transform server error payloads so err.message = server error string
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    const data = error.response?.data as Record<string, unknown> | undefined
    if (data && typeof data.error === 'string') {
      // Attach structured info to the error for components to use
      const apiErr = new Error(data.error as string) as Error & ApiError
      apiErr.type = (data.type as string) ?? 'unknown_error'
      apiErr.fields = (data.fields as Record<string, string[]>) ?? undefined
      return Promise.reject(apiErr)
    }
    return Promise.reject(error)
  }
)
