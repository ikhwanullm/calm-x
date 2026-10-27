import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import { itemKeys } from './useItems'
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
      qc.invalidateQueries({ queryKey: itemKeys.all })
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
      if (previous) {
        // Map tag_names (write field) to tags (read field) for optimistic display
        const { tag_names, ...rest } = payload as Task & { tag_names?: string[] }
        const optimistic: Task = { ...previous, ...rest }
        if (tag_names !== undefined) optimistic.tags = tag_names
        qc.setQueryData<Task>(taskKeys.detail(id), optimistic)
      }
      return { previous }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(taskKeys.detail(id), ctx.previous)
      notify.error("Couldn't save the task. Try again.", err.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: taskKeys.detail(id) })
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't delete task. Try again.", err.message),
  })
}

export function useMoveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskMovePayload }) =>
      tasksApi.move(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't move task. Try again.", err.message),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.complete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.detail(id) })
      const prevDetail = qc.getQueryData<Task>(taskKeys.detail(id))
      if (prevDetail) qc.setQueryData<Task>(taskKeys.detail(id), { ...prevDetail, is_complete: true })
      // Also update list cache optimistically (forItem or inbox)
      const itemId = prevDetail?.item_id ?? null
      const listKey = itemId == null ? taskKeys.inbox() : taskKeys.forItem(itemId)
      const prevList = qc.getQueryData<Task[]>(listKey)
      if (prevList) {
        qc.setQueryData<Task[]>(listKey, prevList.map((t) => t.id === id ? { ...t, is_complete: true } : t))
      }
      return { prevDetail, prevList, itemId }
    },
    onError: (err: Error, id, ctx) => {
      if (ctx?.prevDetail) qc.setQueryData(taskKeys.detail(id), ctx.prevDetail)
      if (ctx?.prevList != null) {
        const lk = ctx.itemId == null ? taskKeys.inbox() : taskKeys.forItem(ctx.itemId)
        qc.setQueryData(lk, ctx.prevList)
      }
      notify.error("Couldn't complete task. Try again.", err.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}

export function useIncompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.incomplete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.detail(id) })
      const prevDetail = qc.getQueryData<Task>(taskKeys.detail(id))
      if (prevDetail) qc.setQueryData<Task>(taskKeys.detail(id), { ...prevDetail, is_complete: false })
      // Also update list cache optimistically (forItem or inbox)
      const itemId = prevDetail?.item_id ?? null
      const listKey = itemId == null ? taskKeys.inbox() : taskKeys.forItem(itemId)
      const prevList = qc.getQueryData<Task[]>(listKey)
      if (prevList) {
        qc.setQueryData<Task[]>(listKey, prevList.map((t) => t.id === id ? { ...t, is_complete: false } : t))
      }
      return { prevDetail, prevList, itemId }
    },
    onError: (err: Error, id, ctx) => {
      if (ctx?.prevDetail) qc.setQueryData(taskKeys.detail(id), ctx.prevDetail)
      if (ctx?.prevList != null) {
        const lk = ctx.itemId == null ? taskKeys.inbox() : taskKeys.forItem(ctx.itemId)
        qc.setQueryData(lk, ctx.prevList)
      }
      notify.error("Couldn't reopen task. Try again.", err.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
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
