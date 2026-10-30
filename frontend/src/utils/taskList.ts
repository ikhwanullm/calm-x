import { addDays, format, parseISO } from 'date-fns'
import type { Task } from '../types/models'
import type { TaskSort, TaskStatus } from '../hooks/useFilterTasks'

export type GroupBy = 'none' | 'project' | 'due' | 'priority'

export const TASK_SORTS: { value: TaskSort; label: string }[] = [
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'project', label: 'Project' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
]

export const GROUPS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'project', label: 'Project' },
  { value: 'due', label: 'Due' },
  { value: 'priority', label: 'Priority' },
]

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

export const isTaskSort = (v: string): v is TaskSort => TASK_SORTS.some((s) => s.value === v)
export const isGroupBy = (v: string): v is GroupBy => GROUPS.some((g) => g.value === v)
export const isTaskStatus = (v: string): v is TaskStatus => STATUSES.some((s) => s.value === v)

export interface TaskGroup {
  key: string
  label: string
  tasks: Task[]
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Sunday of the week containing `today` (weeks start on Monday). */
function weekEnd(today: string): string {
  const d = parseISO(today)
  return iso(addDays(d, 6 - ((d.getDay() + 6) % 7)))
}

/**
 * Split tasks into groups, keeping the incoming order inside each group.
 * Project groups follow the order tasks arrive in (Inbox shows as "Inbox"); due and priority groups
 * have a fixed order and empty ones are left out.
 */
export function groupTasks(tasks: Task[], by: GroupBy, today: string): TaskGroup[] {
  if (by === 'none') return tasks.length ? [{ key: 'all', label: '', tasks }] : []

  const fixed = (defs: { key: string; label: string }[], pick: (t: Task) => string): TaskGroup[] => {
    const groups = defs.map((d) => ({ ...d, tasks: [] as Task[] }))
    for (const t of tasks) groups.find((g) => g.key === pick(t))!.tasks.push(t)
    return groups.filter((g) => g.tasks.length > 0)
  }

  if (by === 'priority') {
    return fixed(
      [{ key: 'high', label: 'High' }, { key: 'medium', label: 'Medium' }, { key: 'low', label: 'Low' }],
      (t) => t.priority,
    )
  }
  if (by === 'due') {
    const end = weekEnd(today)
    return fixed(
      [
        { key: 'overdue', label: 'Overdue' },
        { key: 'earlier', label: 'Earlier (completed)' },
        { key: 'week', label: 'This week' },
        { key: 'later', label: 'Later' },
        { key: 'none', label: 'No due date' },
      ],
      (t) => {
        if (!t.due_date) return 'none'
        if (t.due_date < today) return t.is_complete ? 'earlier' : 'overdue'
        return t.due_date <= end ? 'week' : 'later'
      },
    )
  }

  const groups: TaskGroup[] = []
  for (const t of tasks) {
    const key = t.item_id === null ? 'inbox' : `item-${t.item_id}`
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label: t.item_title ?? 'Inbox', tasks: [] }
      groups.push(group)
    }
    group.tasks.push(t)
  }
  return groups
}
