import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { notify } from '../lib/toast'
import type {
  Task,
  TaskCreatePayload,
  TaskMovePayload,
  TaskReorderPayload,
  TaskUpdatePayload,
} from '../types/models'

export const taskKeys = {
  all: ['tasks'] as const,
  inbox: () => [...taskKeys.all, 'inbox'] as const,
  forItem: (itemId: number) => [...taskKeys.all, 'item', itemId] as const,
  detail: (id: number) => [...taskKeys.all, 'detail', id] as const,
}

export function useInboxTasks() {
  return useQuery({ queryKey: taskKeys.inbox(), queryFn: () => tasksApi.inbox() })
}

export function useItemTasks(itemId: number, opts?: { include_complete?: boolean }) {
  return useQuery({
    queryKey: taskKeys.forItem(itemId),
    queryFn: () => tasksApi.listForItem(itemId, opts),
    enabled: itemId > 0,
  })
}

export function useTask(id: number) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => tasksApi.get(id),
    enabled: id > 0,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TaskCreatePayload) => tasksApi.create(payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      if (vars.item_id) qc.invalidateQueries({ queryKey: taskKeys.forItem(vars.item_id) })
    },
    onError: (err: Error) => {
      notify.error("Couldn't create task. Try again.", err.message)
    },
  })
}

export function useUpdateTask(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TaskUpdatePayload) => tasksApi.update(id, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: taskKeys.detail(id) })
      const previous = qc.getQueryData<Task>(taskKeys.detail(id))
      if (previous) qc.setQueryData<Task>(taskKeys.detail(id), { ...previous, ...payload } as Task)
      return { previous }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.detail(id), ctx.previous)
      notify.error("Couldn't save the task. Try again.", err.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: taskKeys.detail(id) })
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't delete task. Try again.", err.message),
  })
}

export function useMoveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskMovePayload }) =>
      tasksApi.move(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
    onError: (err: Error) => notify.error("Couldn't move task. Try again.", err.message),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.complete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.detail(id) })
      const previous = qc.getQueryData<Task>(taskKeys.detail(id))
      if (previous) qc.setQueryData<Task>(taskKeys.detail(id), { ...previous, is_complete: true })
      return { previous }
    },
    onError: (err: Error, id, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.detail(id), ctx.previous)
      notify.error("Couldn't complete task. Try again.", err.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useIncompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.incomplete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.detail(id) })
      const previous = qc.getQueryData<Task>(taskKeys.detail(id))
      if (previous) qc.setQueryData<Task>(taskKeys.detail(id), { ...previous, is_complete: false })
      return { previous }
    },
    onError: (err: Error, id, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.detail(id), ctx.previous)
      notify.error("Couldn't reopen task. Try again.", err.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useReorderTasks(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TaskReorderPayload) => tasksApi.reorder(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.forItem(itemId) }),
    onError: (err: Error) => notify.error("Couldn't reorder tasks. Try again.", err.message),
  })
}
