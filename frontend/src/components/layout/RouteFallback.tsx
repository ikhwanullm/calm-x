/** Shown while a lazily loaded page is being fetched. Quiet on purpose: it is usually on screen for a blink. */
export function RouteFallback() {
  return (
    <p role="status" className="text-sm text-muted">
      Loading…
    </p>
  )
}
