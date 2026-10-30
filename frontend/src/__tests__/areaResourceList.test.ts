import { describe, it, expect } from 'vitest'
import { filterAreas, filterResources, sortAreas, sortResources } from '../utils/areaResourceList'
import type { AreaFilters, ResourceFilters } from '../utils/areaResourceList'
import type { Area, ProjectStats, Resource, ResourceStats } from '../types/models'

const TODAY = '2026-10-29'
const names = (list: { title: string }[]) => list.map((i) => i.title)

function areaStats(extra: Partial<ProjectStats> = {}): ProjectStats {
  return {
    open_task_count: 0, overdue_task_count: 0, waiting_task_count: 0, next_task: null, next_meeting_at: null,
    last_meeting_at: null, linked_resource_count: 0, last_activity_at: new Date(2026, 9, 28, 10).toISOString(),
    project_count: 0, ...extra,
  }
}

function area(id: number, title: string, stats: Partial<ProjectStats> | null = {}, extra: Partial<Area> = {}): Area {
  return {
    id, type: 'area', title, description: '', notes: '', archived_at: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', task_count: 0, completed_task_count: 0,
    progress_percentage: 0, area_maintenance_notes: null, stats: stats === null ? undefined : areaStats(stats), ...extra,
  }
}

function resource(id: number, title: string, stats: Partial<ResourceStats> | null = {}, extra: Partial<Resource> = {}): Resource {
  return {
    id, type: 'resource', title, description: '', notes: '', archived_at: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: new Date(2026, 9, 28).toISOString(), task_count: 0,
    completed_task_count: 0, progress_percentage: 0,
    stats: stats === null ? undefined : { reference_link_count: 1, linked_item_count: 1, ...stats }, ...extra,
  }
}

const NO_AREA_FILTERS: AreaFilters = { q: '', hasOverdue: false, stale: false, empty: false }
const NO_RESOURCE_FILTERS: ResourceFilters = { q: '', unlinked: false, noLinks: false, stale: false }

describe('areas', () => {
  const list = [
    area(1, 'Work', { project_count: 3, open_task_count: 8, overdue_task_count: 2 }),
    area(2, 'Health', { project_count: 0, open_task_count: 1, last_activity_at: new Date(2026, 8, 1).toISOString() }),
    area(3, 'Family', { project_count: 3, open_task_count: 8 }, { description: 'home and kids' }),
  ]

  it('sorts by name, last activity, overdue, projects and open tasks, ties by name', () => {
    expect(names(sortAreas(list, 'name'))).toEqual(['Family', 'Health', 'Work'])
    expect(names(sortAreas(list, 'activity'))).toEqual(['Family', 'Work', 'Health'])
    expect(names(sortAreas(list, 'overdue'))).toEqual(['Work', 'Family', 'Health'])
    expect(names(sortAreas(list, 'projects'))).toEqual(['Family', 'Work', 'Health'])
    expect(names(sortAreas(list, 'open'))).toEqual(['Family', 'Work', 'Health'])
  })

  it('does not change the input order', () => {
    const before = names(list)
    sortAreas(list, 'overdue')
    expect(names(list)).toEqual(before)
  })

  it('filters: overdue, stale, no projects, and search in title and description', () => {
    const run = (f: Partial<AreaFilters>) => names(filterAreas(list, { ...NO_AREA_FILTERS, ...f }, TODAY))
    expect(run({ hasOverdue: true })).toEqual(['Work'])
    expect(run({ stale: true })).toEqual(['Health'])
    expect(run({ empty: true })).toEqual(['Health'])
    expect(run({ q: 'KIDS' })).toEqual(['Family'])
    expect(run({ q: 'work', hasOverdue: true })).toEqual(['Work'])
    expect(run({})).toHaveLength(3)
  })

  it('without stats nothing matches the stats filters', () => {
    const bare = [area(9, 'Bare', null)]
    expect(filterAreas(bare, { ...NO_AREA_FILTERS, hasOverdue: true }, TODAY)).toEqual([])
    expect(filterAreas(bare, { ...NO_AREA_FILTERS, empty: true }, TODAY)).toEqual([])
    expect(filterAreas(bare, { ...NO_AREA_FILTERS, stale: true }, TODAY)).toEqual([])
  })
})

describe('resources', () => {
  const list = [
    resource(1, 'Style guide', { linked_item_count: 3, reference_link_count: 2 }),
    resource(2, 'Old notes', { linked_item_count: 0, reference_link_count: 0 }, { updated_at: new Date(2026, 5, 1).toISOString() }),
    resource(3, 'Cheat sheet', { linked_item_count: 1 }, { description: 'handy commands', updated_at: new Date(2026, 9, 29).toISOString() }),
  ]

  it('sorts by name, recently updated and most used', () => {
    expect(names(sortResources(list, 'name'))).toEqual(['Cheat sheet', 'Old notes', 'Style guide'])
    expect(names(sortResources(list, 'updated'))).toEqual(['Cheat sheet', 'Style guide', 'Old notes'])
    expect(names(sortResources(list, 'used'))).toEqual(['Style guide', 'Cheat sheet', 'Old notes'])
  })

  it('filters: not linked, no links, stale 90+ days, and search', () => {
    const run = (f: Partial<ResourceFilters>) => names(filterResources(list, { ...NO_RESOURCE_FILTERS, ...f }, TODAY))
    expect(run({ unlinked: true })).toEqual(['Old notes'])
    expect(run({ noLinks: true })).toEqual(['Old notes'])
    expect(run({ stale: true })).toEqual(['Old notes'])
    expect(run({ q: 'COMMANDS' })).toEqual(['Cheat sheet'])
    expect(run({ unlinked: true, q: 'guide' })).toEqual([])
  })

  it('without stats the link filters match nothing', () => {
    expect(filterResources([resource(9, 'Bare', null)], { ...NO_RESOURCE_FILTERS, unlinked: true }, TODAY)).toEqual([])
  })
})
