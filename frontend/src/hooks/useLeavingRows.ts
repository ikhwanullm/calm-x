import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from '@/types/models'

/** How long a completed row stays visible before it starts to leave. */
export const LINGER_MS = 400
/** Length of the exit (fade and collapse); keep in step with --dur in index.css. */
export const LEAVE_MS = 180

interface Entry {
  listKey: string
  /** The task as it was when the checkbox was clicked */
  task: Task
  /** Where it was in its list, so a row that left the data is shown in the same place */
  index: number
  leaving: boolean
}

export interface LeavingRow {
  task: Task
  /** The exit animation is running: fade out and collapse */
  leaving: boolean
  /** The data no longer has this task; it is only kept on screen for the exit */
  retained: boolean
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A completed task leaves most lists at once, because the refetch no longer returns it. This keeps the row on
 * screen, checked and struck through, for LINGER_MS, then lets it fade out and collapse. With reduced motion
 * nothing is kept: the row goes at once.
 *
 * Call `rows(listKey, tasks)` instead of mapping `tasks`, and wrap the checkbox handler with `toggle`.
 * Keep the hook above anything that hides an empty list, or the last row cannot finish its exit.
 */
export function useLeavingRows() {
  const [entries, setEntries] = useState<Entry[]>([])
  const timers = useRef(new Map<number, number[]>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((ids) => ids.forEach((id) => window.clearTimeout(id)))
      pending.clear()
    }
  }, [])

  const cancel = useCallback((taskId: number) => {
    timers.current.get(taskId)?.forEach((id) => window.clearTimeout(id))
    timers.current.delete(taskId)
    setEntries((prev) => prev.filter((e) => e.task.id !== taskId))
  }, [])

  const start = useCallback((listKey: string, tasks: Task[], task: Task) => {
    if (prefersReducedMotion()) return
    const index = Math.max(0, tasks.findIndex((t) => t.id === task.id))
    timers.current.get(task.id)?.forEach((id) => window.clearTimeout(id))
    setEntries((prev) => [
      ...prev.filter((e) => e.task.id !== task.id),
      { listKey, task, index, leaving: false },
    ])
    const leave = window.setTimeout(() => {
      setEntries((prev) => prev.map((e) => (e.task.id === task.id ? { ...e, leaving: true } : e)))
    }, LINGER_MS)
    const done = window.setTimeout(() => {
      timers.current.delete(task.id)
      setEntries((prev) => prev.filter((e) => e.task.id !== task.id))
    }, LINGER_MS + LEAVE_MS + 40)
    timers.current.set(task.id, [leave, done])
  }, [])

  /** The rows to show for a list: its tasks, plus the ones that just left, with a clicked task shown as done. */
  const rows = useCallback(
    (listKey: string, tasks: Task[]): LeavingRow[] => {
      const mine = entries.filter((e) => e.listKey === listKey)
      if (mine.length === 0) return tasks.map((task) => ({ task, leaving: false, retained: false }))
      const out: LeavingRow[] = tasks.map((task) => {
        const entry = mine.find((e) => e.task.id === task.id)
        return entry
          ? { task: { ...task, is_complete: true }, leaving: entry.leaving && !task.is_complete, retained: false }
          : { task, leaving: false, retained: false }
      })
      for (const entry of [...mine].sort((a, b) => a.index - b.index)) {
        if (tasks.some((t) => t.id === entry.task.id)) continue
        out.splice(Math.min(entry.index, out.length), 0, {
          task: { ...entry.task, is_complete: true },
          leaving: entry.leaving,
          retained: true,
        })
      }
      return out
    },
    [entries],
  )

  /** Wraps the page's checkbox handler. `task` is the row as shown, so a row still shown done is reopened. */
  const toggle = useCallback(
    (listKey: string, tasks: Task[], task: Task, run: (task: Task) => void) => {
      if (task.is_complete) cancel(task.id)
      else start(listKey, tasks, task)
      run(task)
    },
    [cancel, start],
  )

  return { rows, toggle }
}
