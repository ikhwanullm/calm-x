import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { itemsApi, type ListItemsParams } from '../api/items'
import { notify } from '../lib/toast'
import { dashboardKeys } from './useDashboard'
import { taskKeys } from './useTasks'
import type {
  Item,
  ItemCreatePayload,
  ItemUpdatePayload,
} from '../types/models'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const itemKeys = {
  all: ['items'] as const,
  list: (filters?: ListItemsParams) =>
    [...itemKeys.all, 'list', filters ?? {}] as const,
  detail: (id: number) => [...itemKeys.all, 'detail', id] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useItems(filters?: ListItemsParams) {
  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: () => itemsApi.list(filters),
  })
}

/**
 * Hook for fetching archived items only.
 * Supports search query, type filter, and date range filters.
 */
export function useArchivedItems(params?: {
  q?: string
  type?: 'project' | 'area' | 'resource'
  archived_from?: string
  archived_to?: string
}) {
  const filters: ListItemsParams = {
    archived: 'only',
    ...params,
  }
  return useQuery({
    queryKey: itemKeys.list(filters),
    queryFn: () => itemsApi.list(filters),
  })
}

export function useItem(id: number) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: () => itemsApi.get(id),
    enabled: id > 0,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ItemCreatePayload) => itemsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't create item. Check that the server is running and try again.", err.message)
    },
  })
}

export function useUpdateItem(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ItemUpdatePayload) => itemsApi.update(id, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(id) })
      const previous = queryClient.getQueryData<Item>(itemKeys.detail(id))
      if (previous) {
        queryClient.setQueryData<Item>(itemKeys.detail(id), {
          ...previous,
          ...payload,
        } as Item)
      }
      return { previous }
    },
    onError: (err: Error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(itemKeys.detail(id), context.previous)
      }
      notify.error("Couldn't save the changes. Try again.", err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => itemsApi.delete(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: itemKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't delete item. Try again.", err.message)
    },
  })
}

export function useArchiveItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => itemsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't archive item. Try again.", err.message)
    },
  })
}

export function useRestoreItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => itemsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't restore item. Try again.", err.message)
    },
  })
}

export function useCompleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => itemsApi.completeProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't complete project. Try again.", err.message)
    },
  })
}

export function useReopenProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => itemsApi.reopenProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't reopen project. Try again.", err.message)
    },
  })
}
