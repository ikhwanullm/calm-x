import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { dashboardKeys } from './useDashboard'
import { useItems } from './useItems'
import { itemKeys } from './useItems'
import { taskKeys } from './useTasks'
import type { CaptureTarget, ParsedCapture } from '../utils/capture'
import type { Task } from '../types/models'

/** Projects (not completed) and areas that "@name" can point to. */
export function useCaptureTargets(): CaptureTarget[] {
  const { data: items } = useItems({ include_archived: false })
  return useMemo(
    () =>
      (items ?? []).flatMap((item): CaptureTarget[] => {
        if (item.type === 'area') return [{ id: item.id, title: item.title, type: 'area' }]
        if (item.type === 'project' && item.project_status !== 'completed') {
          return [{ id: item.id, title: item.title, type: 'project' }]
        }
        return []
      }),
    [items]
  )
}

export interface CaptureOutcome {
  /** The tasks that were created, in order */
  created: Task[]
  /** Indexes (into the parsed list) of the lines that could not be added, with the server's reason */
  failed: { index: number; message: string }[]
}

/** Creates the parsed lines one after another; a line that fails does not stop the others. */
export function useCaptureSubmit() {
  const qc = useQueryClient()
  return async function submit(lines: ParsedCapture[]): Promise<CaptureOutcome> {
    const created: Task[] = []
    const failed: CaptureOutcome['failed'] = []
    for (const [index, line] of lines.entries()) {
      try {
        created.push(
          await tasksApi.create({
            title: line.title,
            priority: line.priority ?? 'medium',
            ...(line.due_date ? { due_date: line.due_date } : {}),
            ...(line.tags.length ? { tag_names: line.tags } : {}),
            ...(line.target ? { item_id: line.target.id } : {}),
          })
        )
      } catch (err) {
        failed.push({ index, message: (err as Error).message })
      }
    }
    if (created.length > 0) {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    }
    return { created, failed }
  }
}
