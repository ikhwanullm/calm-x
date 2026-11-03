import { useRouteError } from 'react-router-dom'
import { Button } from '@/components/common'
import { page } from '@/lib/staleBuild'

/** Shown when a page fails to open, most often because Calm-X was rebuilt while this tab was open. */
export function RouteError() {
  const error = useRouteError()
  console.error(error)
  return (
    <div role="alert" className="p-8 max-w-md">
      <p className="text-sm font-medium text-text">Calm-X was updated.</p>
      <p className="mt-1 text-sm text-muted">Reload the page to continue. Nothing you saved is lost.</p>
      <Button className="mt-4" onClick={() => page.reload()}>
        Reload
      </Button>
    </div>
  )
}
