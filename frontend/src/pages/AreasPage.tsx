import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '@/hooks/useItems'
import { useUrlParams } from '@/hooks/useUrlParams'
import { useViewMode } from '@/hooks/useViewMode'
import { ListToolbar } from '@/components/lists/ListToolbar'
import type { ToolbarChip } from '@/components/lists/ListToolbar'
import { AreaCard, AreaList } from '@/components/areas/AreaViews'
import { NewItemDialog } from '@/components/items/NewItemDialog'
import { EmptyState, Skeleton, SkeletonGroup } from '@/components/common'
import { getLocalToday } from '@/utils/date'
import { AREA_SORTS, filterAreas, isAreaSort, sortAreas } from '@/utils/areaResourceList'
import type { AreaFilters } from '@/utils/areaResourceList'
import { isArchived } from '@/types/models'
import type { Area } from '@/types/models'

const FILTER_KEYS = ['q', 'overdue', 'stale', 'empty']

export default function AreasPage() {
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()
  const today = getLocalToday()
  const url = useUrlParams()
  const [view, setView] = useViewMode('areas')
  const { data: items, isLoading, isError } = useItems({ type: 'area', today })

  const sortParam = url.get('sort')
  const sort = isAreaSort(sortParam) ? sortParam : 'name'
  const filters: AreaFilters = {
    q: url.get('q'),
    hasOverdue: url.get('overdue') === '1',
    stale: url.get('stale') === '1',
    empty: url.get('empty') === '1',
  }
  const hasActiveFilters = filters.q !== '' || filters.hasOverdue || filters.stale || filters.empty
  const clear = () => url.set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))

  const toggle = (id: string, label: string, key: string, on: boolean): ToolbarChip => ({
    kind: 'toggle', id, label, pressed: on, onToggle: () => url.set({ [key]: on ? null : '1' }),
  })
  const chips = [
    toggle('overdue', 'Has overdue', 'overdue', filters.hasOverdue),
    toggle('stale', 'Stale 30+ days', 'stale', filters.stale),
    toggle('empty', 'No projects', 'empty', filters.empty),
  ]

  const areas = (items ?? []).filter((i): i is Area => i.type === 'area' && !isArchived(i))
  const shown = sortAreas(filterAreas(areas, filters, today), sort)

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <SkeletonGroup label="Loading areas">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full mb-3" delay={0} />)}
      </SkeletonGroup>
    )
  } else if (isError) {
    body = <p className="text-sm text-danger-fg">Couldn&apos;t load areas. Check that the server is running and try again.</p>
  } else if (areas.length === 0) {
    body = (
      <EmptyState
        title="No areas yet"
        description="Create your first area to organise responsibilities."
        action={{ label: 'New area', onClick: () => setShowNew(true) }}
        dashedBorder
      />
    )
  } else if (shown.length === 0) {
    body = (
      <div className="text-sm text-muted">
        <p>No areas match these filters.</p>
        <button type="button" onClick={clear} className="mt-1 text-accent-text underline underline-offset-2">Clear filters</button>
      </div>
    )
  } else if (view === 'list') {
    body = <AreaList areas={shown} today={today} />
  } else {
    body = <div className="flex flex-col gap-3">{shown.map((a) => <AreaCard key={a.id} area={a} today={today} />)}</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-text">Areas</h1>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
        >
          + New area
        </button>
      </div>
      {!isLoading && !isError && areas.length > 0 && (
        <ListToolbar
          searchValue={filters.q}
          onSearchChange={(q) => url.set({ q })}
          searchLabel="Search areas"
          sort={{ value: sort, options: AREA_SORTS, onChange: (v) => url.set({ sort: v === 'name' ? null : v }) }}
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
        defaultType="area"
        onCreated={(id) => { setShowNew(false); navigate(`/areas/${id}`) }}
      />
    </div>
  )
}
