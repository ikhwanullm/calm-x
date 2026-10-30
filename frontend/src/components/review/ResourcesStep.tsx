import { useState } from 'react'
import { Clock } from 'lucide-react'
import { useReviewResources } from '@/hooks/useReview'
import { useArchiveItem } from '@/hooks/useItems'
import { formatRelativeDate, getLocalToday } from '@/utils/date'

interface ResourcesStepProps {
  onArchived: () => void
}

type ResourceAction = 'pending' | 'kept' | 'archived'

export function ResourcesStep({ onArchived }: ResourcesStepProps) {
  const today = getLocalToday()
  const { data: resources = [], isLoading } = useReviewResources()
  const archiveItem = useArchiveItem()

  const [resourceActions, setResourceActions] = useState<Record<number, ResourceAction>>({})

  function setAction(id: number, action: ResourceAction) {
    setResourceActions(prev => ({ ...prev, [id]: action }))
  }

  async function handleArchive(id: number) {
    try {
      await archiveItem.mutateAsync(id)
    } catch {
      return  // the hook already showed the error; the resource keeps its buttons
    }
    setAction(id, 'archived')
    onArchived()
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Tidy your resources
        </h1>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Tidy your resources
        </h1>
        <div className="flex flex-col items-center gap-2 py-12 text-center border border-dashed border-border rounded-2xl">
          <span className="text-lg font-semibold text-text">No active resources</span>
          <span className="text-muted text-sm">Create resources to store reference material.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text" style={{ letterSpacing: '-0.02em' }}>
          Tidy your resources
        </h1>
        <p className="text-muted">
          Least recently updated first. Archive what you no longer need close at hand.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {resources.map(resource => {
          const action = resourceActions[resource.id]
          const isPending = !action || action === 'pending'
          const updatedStr = formatRelativeDate(resource.updated_at.split('T')[0], today)

          return (
            <li
              key={resource.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3.5 border border-border rounded-xl bg-surface shadow-[var(--shadow)]"
            >
              {/* Resource info */}
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="font-semibold text-sm text-text">{resource.title}</span>
                <span className="text-muted text-[13px]">
                  Updated{' '}
                  <time
                    dateTime={resource.updated_at.split('T')[0]}
                    title={resource.updated_at}
                    className="underline decoration-dotted underline-offset-2"
                  >
                    {updatedStr.toLowerCase()}
                  </time>
                </span>
              </div>

              {/* Stale badge */}
              {resource.is_stale && (
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-pill bg-warn-bg text-warn-fg text-xs font-semibold shrink-0">
                  <Clock size={12} strokeWidth={2} aria-hidden="true" />
                  Suggest archiving
                </span>
              )}

              {/* Actions or result */}
              {!isPending ? (
                <span className="inline-flex items-center gap-1.5 text-muted text-[13px] font-semibold shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4.5 4.5L19 7" />
                  </svg>
                  {action === 'kept' ? 'Kept' : 'Archived'}
                </span>
              ) : (
                <div
                  role="group"
                  aria-label={`Action for ${resource.title}`}
                  className="flex gap-1.5 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setAction(resource.id, 'kept')}
                    className="h-9 px-3 rounded-control border border-border bg-surface text-text text-[13px] font-semibold hover:bg-surface-2"
                  >
                    Keep
                  </button>
                  {/* New tab: leaving the review page would lose its place and the counts */}
                  <a
                    href={`/resources/${resource.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center h-9 px-3 rounded-control border border-border bg-surface text-text text-[13px] font-semibold hover:bg-surface-2"
                  >
                    Update
                    <span className="sr-only"> {resource.title} in a new tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleArchive(resource.id)}
                    disabled={archiveItem.isPending}
                    className="h-9 px-3 rounded-control border border-border bg-surface text-text text-[13px] font-semibold hover:bg-surface-2 disabled:opacity-50"
                  >
                    Archive
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
