import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '../api/calendar'
import { tasksApi } from '../api/tasks'
import { taskKeys, UNDO_TOAST_MS } from './useTasks'
import { itemKeys } from './useItems'
import { dashboardKeys } from './useDashboard'
import { notify } from '../lib/toast'
import { getLocalToday, getLocalTzOffset } from '../utils/date'
import { dayLabel } from '../utils/week'
import type { CalendarWeek, Task } from '../types/models'

/** Under taskKeys.all so every task mutation refreshes the week as well. */
export const weekKeys = {
  week: (start: string, today: string) => [...taskKeys.all, 'week', start, today] as const,
}

export function useWeek(start: string) {
  const today = getLocalToday()
  return useQuery({
    queryKey: weekKeys.week(start, today),
    queryFn: () => calendarApi.week(start, today, getLocalTzOffset()),
  })
}

/** The week with `task` taken out of every list and put into `toDate`'s due list (if that day is visible). */
export function moveTaskInWeek(week: CalendarWeek, task: Task, toDate: string): CalendarWeek {
  const without = (tasks: Task[]) => tasks.filter((t) => t.id !== task.id)
  return {
    days: week.days.map((d) => ({
      ...d,
      due: d.date === toDate ? [...without(d.due), { ...task, due_date: toDate }] : without(d.due),
      planned: without(d.planned),
      starts: without(d.starts),
    })),
  }
}

/** Drag a task to another day: sets its due date, with an optimistic update, rollback and Undo. */
export function useRescheduleTask() {
  const qc = useQueryClient()

  function refresh() {
    qc.invalidateQueries({ queryKey: taskKeys.all })
    qc.invalidateQueries({ queryKey: itemKeys.all })
    qc.invalidateQueries({ queryKey: dashboardKeys.all })
  }

  async function undo(id: number, previous: string | null) {
    try {
      await tasksApi.update(id, { due_date: previous })
      refresh()
      notify.success('Due date restored')
    } catch (err) {
      notify.error("Couldn't restore the due date.", (err as Error).message)
    }
  }

  return useMutation({
    mutationFn: ({ task, toDate }: { task: Task; toDate: string }) => tasksApi.update(task.id, { due_date: toDate }),
    onMutate: async ({ task, toDate }) => {
      await qc.cancelQueries({ queryKey: [...taskKeys.all, 'week'] })
      const snapshots = qc.getQueriesData<CalendarWeek>({ queryKey: [...taskKeys.all, 'week'] })
      for (const [key, week] of snapshots) {
        if (week) qc.setQueryData<CalendarWeek>(key, moveTaskInWeek(week, task, toDate))
      }
      return { snapshots }
    },
    onError: (err: Error, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, week]) => qc.setQueryData(key, week))
      notify.error("Couldn't move the task.", err.message)
    },
    onSuccess: (_data, { task, toDate }) => {
      refresh()
      notify.success(`Due date moved to ${dayLabel(toDate)}`, {
        action: { label: 'Undo', onClick: () => { void undo(task.id, task.due_date) } },
        duration: UNDO_TOAST_MS,
      })
    },
  })
}
