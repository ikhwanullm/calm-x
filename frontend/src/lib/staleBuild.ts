const RELOAD_KEY = 'calmx.staleReloadAt'
const MIN_GAP_MS = 10_000

/** Wrapped so tests can replace it; jsdom does not allow stubbing window.location. */
export const page = { reload: () => window.location.reload() }

/**
 * Pages load their code when first opened. If the app was rebuilt while a tab stayed open, the files that tab
 * knows about are gone and opening a page fails. Reload once to pick up the new build; the timestamp stops a
 * reload loop if the failure has another cause.
 */
export function reloadOnceForNewBuild(now: number = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (now - last < MIN_GAP_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    return false
  }
  page.reload()
  return true
}

/** Vite fires this event when a lazily loaded file cannot be fetched. */
export function installStaleBuildReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForNewBuild()) event.preventDefault()
  })
}
