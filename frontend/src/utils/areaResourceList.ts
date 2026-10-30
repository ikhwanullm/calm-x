import { daysSinceIso } from './date'
import { STALE_DAYS } from './projectList'
import type { Area, Resource } from '../types/models'

export const RESOURCE_STALE_DAYS = 90

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

export type AreaSort = 'name' | 'activity' | 'overdue' | 'projects' | 'open'

export const AREA_SORTS: { value: AreaSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'activity', label: 'Last activity' },
  { value: 'overdue', label: 'Most overdue' },
  { value: 'projects', label: 'Most projects' },
  { value: 'open', label: 'Most open tasks' },
]

export interface AreaFilters {
  q: string
  hasOverdue: boolean
  stale: boolean
  empty: boolean   // no active projects
}

export const isAreaSort = (v: string): v is AreaSort => AREA_SORTS.some((s) => s.value === v)

export function areaIsStale(a: Area, today: string): boolean {
  return !!a.stats && daysSinceIso(a.stats.last_activity_at, today) >= STALE_DAYS
}

export function filterAreas(areas: Area[], f: AreaFilters, today: string): Area[] {
  const q = f.q.trim().toLowerCase()
  return areas.filter((a) => {
    if (f.hasOverdue && !(a.stats && a.stats.overdue_task_count > 0)) return false
    if (f.stale && !areaIsStale(a, today)) return false
    if (f.empty && !(a.stats && a.stats.project_count === 0)) return false
    if (q && !`${a.title} ${a.description}`.toLowerCase().includes(q)) return false
    return true
  })
}

const byTitle = <T extends { title: string; id: number }>(a: T, b: T) => a.title.localeCompare(b.title) || a.id - b.id

export function sortAreas(areas: Area[], sort: AreaSort): Area[] {
  const list = [...areas]
  switch (sort) {
    case 'activity':
      return list.sort((a, b) => {
        const x = a.stats?.last_activity_at ?? a.updated_at
        const y = b.stats?.last_activity_at ?? b.updated_at
        return x === y ? byTitle(a, b) : x < y ? 1 : -1
      })
    case 'overdue':
      return list.sort((a, b) => (b.stats?.overdue_task_count ?? 0) - (a.stats?.overdue_task_count ?? 0) || byTitle(a, b))
    case 'projects':
      return list.sort((a, b) => (b.stats?.project_count ?? 0) - (a.stats?.project_count ?? 0) || byTitle(a, b))
    case 'open':
      return list.sort((a, b) => (b.stats?.open_task_count ?? 0) - (a.stats?.open_task_count ?? 0) || byTitle(a, b))
    default:
      return list.sort(byTitle)
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type ResourceSort = 'name' | 'updated' | 'used'

export const RESOURCE_SORTS: { value: ResourceSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'used', label: 'Most used' },
]

export interface ResourceFilters {
  q: string
  unlinked: boolean   // not linked to any active Project or Area
  noLinks: boolean    // no reference URLs
  stale: boolean      // not touched for 90+ days
}

export const isResourceSort = (v: string): v is ResourceSort => RESOURCE_SORTS.some((s) => s.value === v)

export function resourceIsStale(r: Resource, today: string): boolean {
  return daysSinceIso(r.updated_at, today) >= RESOURCE_STALE_DAYS
}

export function filterResources(resources: Resource[], f: ResourceFilters, today: string): Resource[] {
  const q = f.q.trim().toLowerCase()
  return resources.filter((r) => {
    if (f.unlinked && !(r.stats && r.stats.linked_item_count === 0)) return false
    if (f.noLinks && !(r.stats && r.stats.reference_link_count === 0)) return false
    if (f.stale && !resourceIsStale(r, today)) return false
    if (q && !`${r.title} ${r.description}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function sortResources(resources: Resource[], sort: ResourceSort): Resource[] {
  const list = [...resources]
  switch (sort) {
    case 'updated':
      return list.sort((a, b) => (a.updated_at === b.updated_at ? byTitle(a, b) : a.updated_at < b.updated_at ? 1 : -1))
    case 'used':
      return list.sort((a, b) => (b.stats?.linked_item_count ?? 0) - (a.stats?.linked_item_count ?? 0) || byTitle(a, b))
    default:
      return list.sort(byTitle)
  }
}
