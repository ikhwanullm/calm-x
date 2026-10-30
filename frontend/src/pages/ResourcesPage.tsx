import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '@/hooks/useItems'
import { useUrlParams } from '@/hooks/useUrlParams'
import { useViewMode } from '@/hooks/useViewMode'
import { ListToolbar } from '@/components/lists/ListToolbar'
import type { ToolbarChip } from '@/components/lists/ListToolbar'
import { ResourceCard, ResourceList } from '@/components/resources/ResourceViews'
import { NewItemDialog } from '@/components/items/NewItemDialog'
import { EmptyState, Skeleton, SkeletonGroup } from '@/components/common'
import { getLocalToday } from '@/utils/date'
import { RESOURCE_SORTS, RESOURCE_STALE_DAYS, filterResources, isResourceSort, sortResources } from '@/utils/areaResourceList'
import type { ResourceFilters } from '@/utils/areaResourceList'
import { isArchived } from '@/types/models'
import type { Resource } from '@/types/models'

const FILTER_KEYS = ['q', 'unlinked', 'nolinks', 'stale']

export default function ResourcesPage() {
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()
  const today = getLocalToday()
  const url = useUrlParams()
  const [view, setView] = useViewMode('resources')
  const { data: items, isLoading, isError } = useItems({ type: 'resource', today })

  const sortParam = url.get('sort')
  const sort = isResourceSort(sortParam) ? sortParam : 'name'
  const filters: ResourceFilters = {
    q: url.get('q'),
    unlinked: url.get('unlinked') === '1',
    noLinks: url.get('nolinks') === '1',
    stale: url.get('stale') === '1',
  }
  const hasActiveFilters = filters.q !== '' || filters.unlinked || filters.noLinks || filters.stale
  const clear = () => url.set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))

  const toggle = (id: string, label: string, key: string, on: boolean): ToolbarChip => ({
    kind: 'toggle', id, label, pressed: on, onToggle: () => url.set({ [key]: on ? null : '1' }),
  })
  const chips = [
    toggle('unlinked', 'Not linked', 'unlinked', filters.unlinked),
    toggle('nolinks', 'No links', 'nolinks', filters.noLinks),
    toggle('stale', `Stale ${RESOURCE_STALE_DAYS}+ days`, 'stale', filters.stale),
  ]

  const resources = (items ?? []).filter((i): i is Resource => i.type === 'resource' && !isArchived(i))
  const shown = sortResources(filterResources(resources, filters, today), sort)

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <SkeletonGroup label="Loading resources">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full mb-3" delay={0} />)}
      </SkeletonGroup>
    )
  } else if (isError) {
    body = <p className="text-sm text-danger-fg">Couldn&apos;t load resources. Check that the server is running and try again.</p>
  } else if (resources.length === 0) {
    body = (
      <EmptyState
        title="No resources yet"
        description="Add your first resource to start collecting reference material."
        action={{ label: 'New resource', onClick: () => setShowNew(true) }}
        dashedBorder
      />
    )
  } else if (shown.length === 0) {
    body = (
      <div className="text-sm text-muted">
        <p>No resources match these filters.</p>
        <button type="button" onClick={clear} className="mt-1 text-accent-text underline underline-offset-2">Clear filters</button>
      </div>
    )
  } else if (view === 'list') {
    body = <ResourceList resources={shown} today={today} />
  } else {
    body = <div className="flex flex-col gap-3">{shown.map((r) => <ResourceCard key={r.id} resource={r} today={today} />)}</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-text">Resources</h1>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
        >
          + New resource
        </button>
      </div>
      {!isLoading && !isError && resources.length > 0 && (
        <ListToolbar
          searchValue={filters.q}
          onSearchChange={(q) => url.set({ q })}
          searchLabel="Search resources"
          sort={{ value: sort, options: RESOURCE_SORTS, onChange: (v) => url.set({ sort: v === 'name' ? null : v }) }}
          chips={chips}
          view={{ value: view, onChange: setView }}
          hasActiveFilters={hasActiveFilters}
          onClear={clear}
        />
      )}
      {body}
      <NewItemDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="resource"
        onCreated={(id) => { setShowNew(false); navigate(`/resources/${id}`) }}
      />
    </div>
  )
}
