import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subtasksApi } from '../api/subtasks'
import { notify } from '../lib/toast'
import { taskKeys } from './useTasks'
import type { SubtaskCreatePayload, SubtaskUpdatePayload } from '../types/models'

export const subtaskKeys = {
  forTask: (taskId: number) => ['subtasks', 'task', taskId] as const,
  detail: (id: number) => ['subtasks', 'detail', id] as const,
}

export function useSubtasks(taskId: number) {
  return useQuery({
    queryKey: subtaskKeys.forTask(taskId),
    queryFn: () => subtasksApi.list(taskId),
    enabled: taskId > 0,
  })
}

export function useCreateSubtask(taskId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubtaskCreatePayload) => subtasksApi.create(taskId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subtaskKeys.forTask(taskId) })
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
    },
    onError: (err: Error) => notify.error("Couldn't add subtask. Try again.", err.message),
  })
}

export function useUpdateSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SubtaskUpdatePayload }) =>
      subtasksApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subtasks'] }),
    onError: (err: Error) => notify.error("Couldn't update subtask. Try again.", err.message),
  })
}

export function useDeleteSubtask(taskId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => subtasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subtaskKeys.forTask(taskId) })
      qc.invalidateQueries({ queryKey: taskKeys.detail(taskId) })
    },
    onError: (err: Error) => notify.error("Couldn't delete subtask. Try again.", err.message),
  })
}

export function useCompleteSubtask(taskId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => subtasksApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subtaskKeys.forTask(taskId) })
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't complete subtask. Try again.", err.message),
  })
}

export function useIncompleteSubtask(taskId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => subtasksApi.incomplete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subtaskKeys.forTask(taskId) })
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't reopen subtask. Try again.", err.message),
  })
}
