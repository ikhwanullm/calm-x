import { describe, it, expect } from 'vitest'
import { groupTasks } from '../utils/taskList'
import type { Task } from '../types/models'

const TODAY = '2026-10-29'  // Thursday; the week ends Sunday 1 Nov

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: 0, created_at: '', updated_at: '', subtask_count: 0,
    completed_subtask_count: 0, tags: [], focus_date: null, waiting_for: null, waiting_since: null, defer_until: null,
    is_someday: false, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

const summary = (groups: ReturnType<typeof groupTasks>) => groups.map((g) => [g.label, g.tasks.map((t) => t.title)])

describe('groupTasks', () => {
  it('none: one unlabelled group in the incoming order, nothing when empty', () => {
    expect(summary(groupTasks([task(1, 'a'), task(2, 'b')], 'none', TODAY))).toEqual([['', ['a', 'b']]])
    expect(groupTasks([], 'none', TODAY)).toEqual([])
  })

  it('project: by project in order of first appearance, Inbox for tasks without one', () => {
    const list = [
      task(1, 'a', { item_id: 5, item_title: 'Zed' }),
      task(2, 'b'),
      task(3, 'c', { item_id: 5, item_title: 'Zed' }),
      task(4, 'd', { item_id: 6, item_title: 'Abc' }),
    ]
    expect(summary(groupTasks(list, 'project', TODAY))).toEqual([['Zed', ['a', 'c']], ['Inbox', ['b']], ['Abc', ['d']]])
  })

  it('due: Overdue, This week (to Sunday), Later, No due date; empty groups are left out', () => {
    const list = [
      task(1, 'late', { due_date: '2026-10-20' }),
      task(2, 'today', { due_date: TODAY }),
      task(3, 'sunday', { due_date: '2026-11-01' }),
      task(4, 'monday', { due_date: '2026-11-02' }),
      task(5, 'none'),
    ]
    expect(summary(groupTasks(list, 'due', TODAY))).toEqual([
      ['Overdue', ['late']], ['This week', ['today', 'sunday']], ['Later', ['monday']], ['No due date', ['none']],
    ])
    expect(summary(groupTasks([task(1, 'x', { due_date: '2026-11-09' })], 'due', TODAY))).toEqual([['Later', ['x']]])
  })

  it('due: a completed task that was due earlier is not "overdue"', () => {
    const list = [task(1, 'done', { due_date: '2026-10-20', is_complete: true }), task(2, 'open', { due_date: '2026-10-21' })]
    expect(summary(groupTasks(list, 'due', TODAY))).toEqual([['Overdue', ['open']], ['Earlier (completed)', ['done']]])
  })

  it('priority: High, Medium, Low', () => {
    const list = [task(1, 'l', { priority: 'low' }), task(2, 'h', { priority: 'high' }), task(3, 'm')]
    expect(summary(groupTasks(list, 'priority', TODAY))).toEqual([['High', ['h']], ['Medium', ['m']], ['Low', ['l']]])
  })
})
