import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { taskKeys } from './useTasks'
import { tagsApi } from '../api/tags'
import { notify } from '../lib/toast'
import type { TagCreatePayload, TagRenamePayload } from '../types/models'

export const tagKeys = {
  all: ['tags'] as const,
}

export function useTags() {
  return useQuery({ queryKey: tagKeys.all, queryFn: tagsApi.list })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TagCreatePayload) => tagsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
    onError: (err: Error) => notify.error("Couldn't create tag. Try again.", err.message),
  })
}

export function useRenameTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TagRenamePayload }) =>
      tagsApi.rename(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all })
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't rename tag. Try again.", err.message),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tagsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all })
      qc.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't delete tag. Try again.", err.message),
  })
}
