import { useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Archive, Search, X, RotateCcw, Trash2 } from 'lucide-react'
import { useArchivedItems, useRestoreItem, useDeleteItem } from '@/hooks/useItems'
import {
  Card,
  EmptyState,
  ConfirmDialog,
  Skeleton,
  SkeletonGroup,
} from '@/components/common'
import { notify } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { Item, ItemType } from '@/types/models'
import {
  formatAbsoluteDate,
  formatRelativeDate,
  getLocalToday,
  isoToLocalDateStr,
  localDateToStartISO,
  localDateToEndISO,
} from '@/utils/date'

const TYPE_LABELS: Record<ItemType, string> = {
  project: 'Project',
  area: 'Area',
  resource: 'Resource',
}

const TYPE_ROUTES: Record<ItemType, string> = {
  project: 'projects',
  area: 'areas',
  resource: 'resources',
}

interface ArchiveFilters {
  q: string
  type: ItemType | ''
  archived_from: string
  archived_to: string
}

function parseFilters(searchParams: URLSearchParams): ArchiveFilters {
  return {
    q: searchParams.get('q') ?? '',
    type: (searchParams.get('type') as ItemType | '') ?? '',
    archived_from: searchParams.get('archived_from') ?? '',
    archived_to: searchParams.get('archived_to') ?? '',
  }
}

function filtersToParams(filters: ArchiveFilters): Record<string, string> {
  const result: Record<string, string> = {}
  if (filters.q) result.q = filters.q
  if (filters.type) result.type = filters.type
  if (filters.archived_from) result.archived_from = filters.archived_from
  if (filters.archived_to) result.archived_to = filters.archived_to
  return result
}

export default function ArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  // Local state for input fields (synced to URL on submit/change)
  const [searchInput, setSearchInput] = useState(filters.q)

  // State for delete confirmation dialog
  const [deleteDialogItem, setDeleteDialogItem] = useState<Item | null>(null)

  // Build API query params — convert local dates to timezone-aware ISO datetimes
  // so the backend can filter correctly across timezone boundaries.
  const queryParams = useMemo(() => {
    const params: {
      q?: string
      type?: 'project' | 'area' | 'resource'
      archived_from?: string
      archived_to?: string
    } = {}
    if (filters.q) params.q = filters.q
    if (filters.type) params.type = filters.type as ItemType
    // Send as ISO 8601 with local tz offset so server compares in UTC correctly
    if (filters.archived_from) params.archived_from = localDateToStartISO(filters.archived_from)
    if (filters.archived_to) params.archived_to = localDateToEndISO(filters.archived_to)
    return params
  }, [filters])

  const { data: items, isLoading, isError } = useArchivedItems(queryParams)
  const restoreMutation = useRestoreItem()
  const deleteMutation = useDeleteItem()

  const today = getLocalToday()

  // Update URL params
  function updateFilters(updates: Partial<ArchiveFilters>) {
    const newFilters = { ...filters, ...updates }
    setSearchParams(filtersToParams(newFilters), { replace: true })
  }

  // Handle search form submission
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateFilters({ q: searchInput.trim() })
  }

  // Clear all filters
  function clearFilters() {
    setSearchInput('')
    setSearchParams({}, { replace: true })
  }

  // Restore an item
  async function handleRestore(item: Item) {
    const route = `/${TYPE_ROUTES[item.type]}/${item.id}`
    try {
      await restoreMutation.mutateAsync(item.id)
      notify.success('Item restored', {
        description: `${item.title} moved back to ${TYPE_LABELS[item.type]}s.`,
        action: { label: 'Open', onClick: () => { window.location.href = route } },
      })
    } catch {
      // Error is handled in the hook
    }
  }

  // Permanently delete an item (with confirmation)
  async function handleConfirmDelete() {
    if (!deleteDialogItem) return
    try {
      await deleteMutation.mutateAsync(deleteDialogItem.id)
      notify.success('Item permanently deleted')
      setDeleteDialogItem(null)
    } catch {
      // Error is handled in the hook
      setDeleteDialogItem(null)
    }
  }

  // Check if any filters are active
  const hasActiveFilters = filters.q || filters.type || filters.archived_from || filters.archived_to

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Archive size={24} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-text">Archive</h1>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6 space-y-4">
        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              strokeWidth={1.75}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search archived items..."
              aria-label="Search archived items"
              className={cn(
                'w-full h-10 pl-9 pr-3 rounded-control border border-border bg-surface text-text text-sm',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0',
                'placeholder:text-muted'
              )}
            />
          </div>
          <button
            type="submit"
            className="h-10 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
          >
            Search
          </button>
        </form>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="type-filter" className="text-sm text-muted">
              Type:
            </label>
            <select
              id="type-filter"
              value={filters.type}
              onChange={(e) => updateFilters({ type: e.target.value as ItemType | '' })}
              className={cn(
                'h-9 px-3 rounded-control border border-border bg-surface text-text text-sm',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0'
              )}
            >
              <option value="">All types</option>
              <option value="project">Projects</option>
              <option value="area">Areas</option>
              <option value="resource">Resources</option>
            </select>
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-2">
            <label htmlFor="archived-from" className="text-sm text-muted">
              Archived from:
            </label>
            <input
              id="archived-from"
              type="date"
              value={filters.archived_from}
              onChange={(e) => updateFilters({ archived_from: e.target.value })}
              className={cn(
                'h-9 px-3 rounded-control border border-border bg-surface text-text text-sm',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0'
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="archived-to" className="text-sm text-muted">
              to:
            </label>
            <input
              id="archived-to"
              type="date"
              value={filters.archived_to}
              onChange={(e) => updateFilters({ archived_to: e.target.value })}
              className={cn(
                'h-9 px-3 rounded-control border border-border bg-surface text-text text-sm',
                'focus:outline-2 focus:outline-accent focus:outline-offset-0'
              )}
            />
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 h-9 px-3 rounded-control text-sm text-muted hover:text-text hover:bg-surface-2"
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonGroup label="Loading archived items">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full mb-3" delay={0} />
          ))}
        </SkeletonGroup>
      ) : isError ? (
        <p className="text-sm text-danger-fg">
          Couldn&apos;t load archived items. Check that the server is running and try again.
        </p>
      ) : items && items.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No matching items"
            description="Try adjusting your search or filters."
            action={{ label: 'Clear filters', onClick: clearFilters }}
            dashedBorder
          />
        ) : (
          <EmptyState
            title="Archive is empty"
            description="Archived items will appear here."
            dashedBorder
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {items?.map((item) => (
            <ArchiveItemCard
              key={item.id}
              item={item}
              today={today}
              onRestore={() => handleRestore(item)}
              onDelete={() => setDeleteDialogItem(item)}
              isRestoring={restoreMutation.isPending && restoreMutation.variables === item.id}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogItem !== null}
        onOpenChange={(open) => { if (!open) setDeleteDialogItem(null) }}
        title="Delete permanently"
        description="This item will be permanently deleted. This action cannot be undone."
        confirmLabel={`Delete ${deleteDialogItem?.title ?? 'item'}`}
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  )
}

interface ArchiveItemCardProps {
  item: Item
  today: string
  onRestore: () => void
  onDelete: () => void
  isRestoring: boolean
}

function ArchiveItemCard({ item, today, onRestore, onDelete, isRestoring }: ArchiveItemCardProps) {
  // Convert archived_at (UTC ISO datetime) to local YYYY-MM-DD date string
  const archivedDate = item.archived_at
    ? isoToLocalDateStr(item.archived_at)
    : null

  const relativeDate = archivedDate ? formatRelativeDate(archivedDate, today) : ''
  const absoluteDate = archivedDate ? formatAbsoluteDate(archivedDate) : ''

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <Link
          to={`/${TYPE_ROUTES[item.type]}/${item.id}`}
          className="flex-1 min-w-0 group"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted px-2 py-0.5 bg-surface-2 rounded">
              {TYPE_LABELS[item.type]}
            </span>
            <h2 className="text-sm font-semibold text-text truncate group-hover:text-accent-text">
              {item.title}
            </h2>
          </div>
          {item.description && (
            <p className="text-xs text-muted mt-1 line-clamp-1">{item.description}</p>
          )}
          {archivedDate && (
            <p className="text-xs text-muted mt-2">
              Archived{' '}
              <time
                dateTime={archivedDate}
                title={absoluteDate}
                className="underline decoration-dotted cursor-default"
              >
                {relativeDate.toLowerCase()}
              </time>
            </p>
          )}
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRestore}
            disabled={isRestoring}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-control text-sm font-medium',
              'border border-border bg-surface text-text',
              'hover:bg-surface-2 disabled:opacity-50'
            )}
            aria-label={`Restore ${item.title}`}
          >
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
            {isRestoring ? 'Restoring...' : 'Restore'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-control text-sm font-medium',
              'text-danger-fg hover:bg-danger-bg'
            )}
            aria-label={`Delete ${item.title} permanently`}
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>
    </Card>
  )
}
