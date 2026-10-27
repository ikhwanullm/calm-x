import { describe, it, expect } from 'vitest'
import { taskKeys } from '../hooks/useTasks'
import { subtaskKeys } from '../hooks/useSubtasks'
import { tagKeys } from '../hooks/useTags'

describe('Query key factories', () => {
  it('taskKeys.inbox()', () => expect(taskKeys.inbox()).toEqual(['tasks', 'inbox']))
  it('taskKeys.forItem(1)', () => expect(taskKeys.forItem(1)).toEqual(['tasks', 'item', 1]))
  it('taskKeys.detail(5)', () => expect(taskKeys.detail(5)).toEqual(['tasks', 'detail', 5]))
  it('subtaskKeys.forTask(3)', () => expect(subtaskKeys.forTask(3)).toEqual(['subtasks', 'task', 3]))
  it('tagKeys.all', () => expect(tagKeys.all).toEqual(['tags']))
})
