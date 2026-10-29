import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Read and change query-string params without touching the others; changes replace the history entry. */
export function useUrlParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const set = useCallback((changes: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  return { params: searchParams, get: (key: string) => searchParams.get(key) ?? '', set }
}
