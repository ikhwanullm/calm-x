import { useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { dashboardKeys } from './useDashboard'
import { itemKeys } from './useItems'
import { taskKeys, UNDO_TOAST_MS } from './useTasks'
import { notify } from '../lib/toast'
import type { Task, TaskUpdatePayload } from '../types/models'

const plural = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`

/**
 * Do one thing to one or several tasks at once (Inbox triage). Every task is tried; the toast says how many
 * worked and, if some did not, shows the first reason. Nothing is rolled back for the ones that worked.
 */
export function useTriage() {
  const qc = useQueryClient()

  function refresh() {
    qc.invalidateQueries({ queryKey: taskKeys.all })
    qc.invalidateQueries({ queryKey: itemKeys.all })
    qc.invalidateQueries({ queryKey: dashboardKeys.all })
  }

  function report(done: number, failures: string[], text: (n: number) => string) {
    if (done > 0) notify.success(text(done))
    if (failures.length > 0) notify.error(`${plural(failures.length)} could not be changed.`, failures[0])
  }

  /** Returns how many tasks were changed. */
  async function updateMany(tasks: Task[], build: (task: Task) => TaskUpdatePayload, text: (n: number) => string) {
    const results = await Promise.allSettled(tasks.map((t) => tasksApi.update(t.id, build(t))))
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as Error).message] : []))
    const done = results.length - failures.length
    if (done > 0) refresh()
    report(done, failures, text)
    return done
  }

  /** Delete, with one Undo that brings back every task that was deleted. */
  async function deleteMany(tasks: Task[]) {
    const results = await Promise.allSettled(tasks.map((t) => tasksApi.delete(t.id).then(() => t.id)))
    const deleted = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    const failures = results.flatMap((r) => (r.status === 'rejected' ? [(r.reason as Error).message] : []))
    if (deleted.length > 0) {
      refresh()
      notify.success(`Deleted ${plural(deleted.length)}`, {
        action: {
          label: 'Undo',
          onClick: () => {
            void Promise.allSettled(deleted.map((id) => tasksApi.restore(id))).then((restored) => {
              refresh()
              const ok = restored.filter((r) => r.status === 'fulfilled').length
              if (ok === deleted.length) notify.success(`Restored ${plural(ok)}`)
              else notify.error(`Only ${ok} of ${deleted.length} could be restored.`)
            })
          },
        },
        duration: UNDO_TOAST_MS,
      })
    }
    if (failures.length > 0) notify.error(`${plural(failures.length)} could not be deleted.`, failures[0])
    return deleted.length
  }

  return { updateMany, deleteMany }
}
