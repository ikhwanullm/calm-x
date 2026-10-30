import { describe, it, expect } from 'vitest'
import { filterProjects, isStale, sortProjects } from '../utils/projectList'
import type { ProjectFilters } from '../utils/projectList'
import { activityLabel, meetingLabel } from '../utils/projectFacts'
import type { Project, ProjectStats } from '../types/models'

const TODAY = '2026-10-29'  // Thursday

function stats(extra: Partial<ProjectStats> = {}): ProjectStats {
  return {
    open_task_count: 1, overdue_task_count: 0, waiting_task_count: 0, next_task: null,
    next_meeting_at: null, last_meeting_at: null, linked_resource_count: 0, project_count: 0,
    last_activity_at: '2026-10-28T10:00:00Z', ...extra,
  }
}

function project(id: number, title: string, extra: Partial<Project> = {}): Project {
  return {
    id, type: 'project', title, description: '', notes: '', archived_at: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    task_count: 4, completed_task_count: 2, progress_percentage: 50,
    project_goal: null, project_deadline: null, project_status: 'active', project_completed_at: null,
    area_id: null, area_title: null, area_archived: false, stats: stats(), ...extra,
  }
}

const NO_FILTERS: ProjectFilters = { q: '', active: true, completed: false, area: '', deadline: '', hasOverdue: false, stale: false }
const names = (list: Project[]) => list.map((p) => p.title)

describe('sortProjects', () => {
  const list = [
    project(1, 'Zeta', { project_deadline: '2026-11-10', progress_percentage: 80 }),
    project(2, 'Alpha'),
    project(3, 'Beta', { project_deadline: '2026-10-30', progress_percentage: 10, stats: stats({ overdue_task_count: 3, last_activity_at: '2026-10-01T10:00:00Z' }) }),
    project(4, 'Gamma', { project_deadline: '2026-10-30', progress_percentage: 10, stats: stats({ overdue_task_count: 1 }) }),
  ]

  it('deadline: soonest first, no deadline last, ties by title', () => {
    expect(names(sortProjects(list, 'deadline'))).toEqual(['Beta', 'Gamma', 'Zeta', 'Alpha'])
  })

  it('progress: lowest first, ties by title', () => {
    expect(names(sortProjects(list, 'progress'))).toEqual(['Beta', 'Gamma', 'Alpha', 'Zeta'])
  })

  it('overdue: most overdue tasks first, ties by title', () => {
    expect(names(sortProjects(list, 'overdue'))).toEqual(['Beta', 'Gamma', 'Alpha', 'Zeta'])
  })

  it('activity: most recent first', () => {
    const ordered = names(sortProjects(list, 'activity'))
    expect(ordered[ordered.length - 1]).toBe('Beta')
  })

  it('name: alphabetical, and the input is not changed', () => {
    const before = names(list)
    expect(names(sortProjects(list, 'name'))).toEqual(['Alpha', 'Beta', 'Gamma', 'Zeta'])
    expect(names(list)).toEqual(before)
  })
})

describe('filterProjects', () => {
  const list = [
    project(1, 'Active, late', { project_deadline: '2026-10-20', area_id: 7, area_title: 'Platform', stats: stats({ overdue_task_count: 2 }) }),
    project(2, 'Active, this week', { project_deadline: '2026-10-31' }),
    project(3, 'Active, next month', { project_deadline: '2026-11-20' }),
    project(4, 'Done', { project_status: 'completed', project_deadline: '2026-10-01' }),
    project(5, 'Quiet', { stats: stats({ last_activity_at: '2026-09-01T10:00:00Z' }) }),
  ]
  const run = (f: Partial<ProjectFilters>) => names(filterProjects(list, { ...NO_FILTERS, ...f }, TODAY))

  it('shows active projects by default, completed only on request, both together, or neither', () => {
    expect(run({})).toEqual(['Active, late', 'Active, this week', 'Active, next month', 'Quiet'])
    expect(run({ active: false, completed: true })).toEqual(['Done'])
    expect(run({ completed: true })).toHaveLength(5)
    expect(run({ active: false })).toEqual([])
  })

  it('filters by area, including "no area"', () => {
    expect(run({ area: '7' })).toEqual(['Active, late'])
    expect(run({ area: 'none' })).toHaveLength(3)
  })

  it('filters by deadline: overdue, this week (to Sunday), next 30 days, none', () => {
    expect(run({ deadline: 'overdue' })).toEqual(['Active, late'])
    expect(run({ deadline: 'week' })).toEqual(['Active, this week'])
    expect(run({ deadline: '30days' })).toEqual(['Active, this week', 'Active, next month'])
    expect(run({ deadline: 'none' })).toEqual(['Quiet'])
  })

  it('a completed project is never "overdue"', () => {
    expect(names(filterProjects(list, { ...NO_FILTERS, completed: true, deadline: 'overdue' }, TODAY))).toEqual(['Active, late'])
  })

  it('has overdue tasks / stale 30+ days', () => {
    expect(run({ hasOverdue: true })).toEqual(['Active, late'])
    expect(run({ stale: true })).toEqual(['Quiet'])
  })

  it('searches title, description and area name, ignoring case', () => {
    expect(run({ q: 'PLATFORM' })).toEqual(['Active, late'])
    expect(run({ q: 'next month' })).toEqual(['Active, next month'])
  })

  it('combines filters', () => {
    expect(run({ deadline: '30days', q: 'month' })).toEqual(['Active, next month'])
    expect(run({ hasOverdue: true, stale: true })).toEqual([])
  })

  it('without stats nothing is stale or overdue', () => {
    const bare = project(9, 'Bare', { stats: undefined })
    expect(isStale(bare, TODAY)).toBe(false)
    expect(filterProjects([bare], { ...NO_FILTERS, hasOverdue: true }, TODAY)).toEqual([])
  })
})

describe('project facts', () => {
  it('meeting label: today with time, weekday this week, date later, else the last meeting', () => {
    const at = (iso: string) => project(1, 'P', { stats: stats({ next_meeting_at: iso }) })
    const later = new Date(2026, 9, 29, 15, 30).toISOString()
    expect(meetingLabel(at(later), TODAY)).toBe('Meeting today 15:30')
    expect(meetingLabel(at(new Date(2026, 10, 3, 9, 0).toISOString()), TODAY)).toBe('Meeting Tue')
    expect(meetingLabel(at(new Date(2026, 10, 20, 9, 0).toISOString()), TODAY)).toBe('Meeting 20 Nov')
    expect(meetingLabel(project(1, 'P', { stats: stats({ last_meeting_at: new Date(2026, 9, 26, 9, 0).toISOString() }) }), TODAY))
      .toBe('Last meeting 3 days ago')
    expect(meetingLabel(project(1, 'P'), TODAY)).toBeNull()
  })

  it('activity label: "updated …" until 30 days, then a warning', () => {
    const a = (iso: string, extra: Partial<Project> = {}) => activityLabel(project(1, 'P', { ...extra, stats: stats({ last_activity_at: iso }) }), TODAY)
    expect(a(new Date(2026, 9, 29, 8, 0).toISOString())).toEqual({ text: 'updated today', stale: false })
    expect(a(new Date(2026, 9, 26, 8, 0).toISOString())).toEqual({ text: 'updated 3 days ago', stale: false })
    expect(a(new Date(2026, 8, 1, 8, 0).toISOString())).toEqual({ text: 'no activity for 58 days', stale: true })
    expect(a(new Date(2026, 8, 1, 8, 0).toISOString(), { project_status: 'completed' })?.stale).toBe(false)
  })
})
