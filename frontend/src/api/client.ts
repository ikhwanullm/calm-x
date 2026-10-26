import axios from 'axios'

/**
 * Axios instance pre-configured for Calm-X API calls.
 * - baseURL: '/api' (proxied to http://127.0.0.1:8080 by Vite dev server)
 * - X-Calm-X: '1' header on every request (required by CSRF middleware)
 */
export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'X-Calm-X': '1',
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})
