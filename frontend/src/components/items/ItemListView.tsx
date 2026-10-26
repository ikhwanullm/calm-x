import type { Item, ItemType } from '@/types/models'
import { isProject, isArchived } from '@/types/models'
import { useItems } from '@/hooks/useItems'
import { CardLink, EmptyState, ProgressBar, StatusBadge, Skeleton, SkeletonGroup } from '@/components/common'
import { getDeadlineStatus } from '@/utils/deadline'
import { getLocalToday } from '@/utils/date'

interface ItemListViewProps {
  type: ItemType
  title: string
  emptyTitle: string
  emptyDescription: string
  newItemLabel: string
  onNew: () => void
  /** Base path for item detail links e.g. "/projects" */
  basePath: string
}

export function ItemListView({
  type,
  title,
  emptyTitle,
  emptyDescription,
  newItemLabel,
  onNew,
  basePath,
}: ItemListViewProps) {
  const { data: items, isLoading, isError } = useItems({ type })
  const today = getLocalToday()

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text mb-6">{title}</h1>
        <SkeletonGroup label={`Loading ${title.toLowerCase()}`}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full mb-3" delay={0} />
          ))}
        </SkeletonGroup>
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-text mb-6">{title}</h1>
        <p className="text-sm text-danger-fg">
          Couldn&apos;t load {title.toLowerCase()}. Check that the server is running and try again.
        </p>
      </div>
    )
  }

  const activeItems = (items ?? []).filter(item => !isArchived(item))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
        >
          + {newItemLabel}
        </button>
      </div>

      {activeItems.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={{ label: newItemLabel, onClick: onNew }}
          dashedBorder
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activeItems.map((item) => (
            <ItemCard key={item.id} item={item} basePath={basePath} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, basePath, today }: { item: Item; basePath: string; today: string }) {
  const deadlineStatus = isProject(item) && item.project_deadline
    ? getDeadlineStatus(item.project_deadline, item.project_status === 'completed', 3, today)
    : null

  return (
    <CardLink to={`${basePath}/${item.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-text truncate">{item.title}</h2>
          {item.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.description}</p>
          )}
          {isProject(item) && (
            <div className="mt-2 max-w-xs">
              <ProgressBar
                completed={item.completed_task_count}
                total={item.task_count}
                label={`${item.title} progress`}
              />
            </div>
          )}
        </div>
        {deadlineStatus && (
          <StatusBadge
            status={deadlineStatus}
            date={isProject(item) ? item.project_deadline! : ''}
            today={today}
          />
        )}
      </div>
    </CardLink>
  )
}
