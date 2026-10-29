import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

/**
 * Debounced autosave for a patch-style update.
 *
 * `schedule(patch)` merges the patch into what is pending and saves after `delayMs` of quiet.
 * `flush()` saves right away and resolves when everything pending is saved (or a save failed).
 * Pending changes are flushed when the component unmounts, so navigating away never loses typing;
 * a failed save keeps its patch and is retried on the next change or flush.
 */
export function useAutosave<P extends object>(save: (patch: P) => Promise<unknown>, delayMs = 1000) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const pending = useRef<P | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const draining = useRef<Promise<void> | null>(null)
  const failed = useRef(false)
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })

  const drain = useCallback((): Promise<void> => {
    if (draining.current) return draining.current
    const run = (async () => {
      setStatus('saving')
      failed.current = false
      while (pending.current) {
        const patch = pending.current
        pending.current = null
        try {
          await saveRef.current(patch)
        } catch {
          pending.current = { ...patch, ...(pending.current ?? {}) }
          failed.current = true
          setStatus('error')
          return
        }
      }
      setStatus('saved')
    })().finally(() => {
      draining.current = null
      // A change that arrived just as the loop ended
      if (pending.current && !failed.current) void drain()
    })
    draining.current = run
    return run
  }, [])

  const schedule = useCallback((patch: P) => {
    pending.current = { ...(pending.current ?? {}), ...patch } as P
    setStatus('unsaved')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { void drain() }, delayMs)
  }, [delayMs, drain])

  /** Saves everything pending now. Resolves true when nothing is left unsaved. */
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    if (pending.current || draining.current) await drain()
    return !failed.current && !pending.current
  }, [drain])

  // Unmount: don't lose pending typing
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (pending.current) void drain()
  }, [drain])

  const hasUnsaved = status === 'unsaved' || status === 'saving' || status === 'error'

  // Closing the tab or window with unsaved changes
  useEffect(() => {
    if (!hasUnsaved) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsaved])

  return { status, schedule, flush, hasUnsaved }
}
