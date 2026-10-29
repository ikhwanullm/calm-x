import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { isoToLocalDateStr } from './date'
import type { Project } from '../types/models'

export type ProjectSort = 'deadline' | 'progress' | 'overdue' | 'activity' | 'name'
export type DeadlineFilter = '' | 'overdue' | 'week' | '30days' | 'none'

export const PROJECT_SORTS: { value: ProjectSort; label: string }[] = [
  { value: 'deadline', label: 'Deadline (soonest)' },
  { value: 'progress', label: 'Progress (lowest)' },
  { value: 'overdue', label: 'Most overdue' },
  { value: 'activity', label: 'Last activity' },
  { value: 'name', label: 'Name' },
]

export const DEADLINE_FILTERS: { value: DeadlineFilter; label: string }[] = [
  { value: '', label: 'Deadline: any' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'This week' },
  { value: '30days', label: 'Next 30 days' },
  { value: 'none', label: 'No deadline' },
]

export const STALE_DAYS = 30

export interface ProjectFilters {
  q: string
  active: boolean
  completed: boolean
  /** '' = every area, 'none' = projects without an area, otherwise an area id */
  area: string
  deadline: DeadlineFilter
  hasOverdue: boolean
  stale: boolean
}

export function isSortValue(value: string): value is ProjectSort {
  return PROJECT_SORTS.some((s) => s.value === value)
}

export function isDeadlineFilter(value: string): value is DeadlineFilter {
  return DEADLINE_FILTERS.some((f) => f.value === value)
}

const isCompleted = (p: Project) => p.project_status === 'completed'

/** Days since the last activity (0 = today); null when the list was loaded without stats. */
export function daysSinceActivity(p: Project, today: string): number | null {
  if (!p.stats) return null
  return differenceInCalendarDays(parseISO(today), parseISO(isoToLocalDateStr(p.stats.last_activity_at)))
}

export function isStale(p: Project, today: string): boolean {
  const days = daysSinceActivity(p, today)
  return !isCompleted(p) && days !== null && days >= STALE_DAYS
}

function matchesDeadline(p: Project, filter: DeadlineFilter, today: string): boolean {
  const deadline = p.project_deadline
  if (filter === '') return true
  if (filter === 'none') return deadline === null
  if (deadline === null) return false
  if (filter === 'overdue') return deadline < today && !isCompleted(p)
  const weekEnd = isoDate(addDays(parseISO(today), 6 - ((parseISO(today).getDay() + 6) % 7)))
  if (filter === 'week') return deadline >= today && deadline <= weekEnd
  return deadline >= today && deadline <= isoDate(addDays(parseISO(today), 30))
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

export function filterProjects(projects: Project[], f: ProjectFilters, today: string): Project[] {
  const q = f.q.trim().toLowerCase()
  return projects.filter((p) => {
    if (!((f.active && !isCompleted(p)) || (f.completed && isCompleted(p)))) return false
    if (f.area === 'none' && p.area_id !== null) return false
    if (f.area !== '' && f.area !== 'none' && p.area_id !== Number(f.area)) return false
    if (!matchesDeadline(p, f.deadline, today)) return false
    if (f.hasOverdue && !(p.stats && p.stats.overdue_task_count > 0)) return false
    if (f.stale && !isStale(p, today)) return false
    if (q) {
      const haystack = `${p.title} ${p.description} ${p.area_title ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

const byTitle = (a: Project, b: Project) => a.title.localeCompare(b.title) || a.id - b.id

/** A new sorted array; ties fall back to the title so the order is stable. */
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  const list = [...projects]
  switch (sort) {
    case 'deadline':
      return list.sort((a, b) => {
        if (a.project_deadline === b.project_deadline) return byTitle(a, b)
        if (a.project_deadline === null) return 1
        if (b.project_deadline === null) return -1
        return a.project_deadline < b.project_deadline ? -1 : 1
      })
    case 'progress':
      return list.sort((a, b) => a.progress_percentage - b.progress_percentage || byTitle(a, b))
    case 'overdue':
      return list.sort((a, b) => (b.stats?.overdue_task_count ?? 0) - (a.stats?.overdue_task_count ?? 0) || byTitle(a, b))
    case 'activity':
      return list.sort((a, b) => {
        const x = a.stats?.last_activity_at ?? a.updated_at
        const y = b.stats?.last_activity_at ?? b.updated_at
        return x === y ? byTitle(a, b) : x < y ? 1 : -1
      })
    default:
      return list.sort(byTitle)
  }
}
