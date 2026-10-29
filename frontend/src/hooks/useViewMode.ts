import { useState } from 'react'

export type ViewMode = 'cards' | 'list'

/** Cards or compact list, remembered per page in localStorage (cards when storage is unavailable). */
export function useViewMode(page: string): [ViewMode, (mode: ViewMode) => void] {
  const key = `calmx.view.${page}`
  const [mode, setMode] = useState<ViewMode>(() => {
    try { return localStorage.getItem(key) === 'list' ? 'list' : 'cards' } catch { return 'cards' }
  })

  function update(next: ViewMode) {
    setMode(next)
    try { localStorage.setItem(key, next) } catch { /* remembering is optional */ }
  }

  return [mode, update]
}
