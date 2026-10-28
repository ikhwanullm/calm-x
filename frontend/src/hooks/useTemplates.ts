import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { templatesApi } from '../api/templates'
import { notify } from '../lib/toast'
import { itemKeys } from './useItems'
import { dashboardKeys } from './useDashboard'
import type {
  TemplateDetail,
  TemplateTask,
  TemplateCreatePayload,
  TemplateUpdatePayload,
  TemplateTaskCreatePayload,
  TemplateTaskUpdatePayload,
  CreateProjectFromTemplatePayload,
} from '../types/models'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const templateKeys = {
  all: ['templates'] as const,
  list: () => [...templateKeys.all, 'list'] as const,
  detail: (id: number) => [...templateKeys.all, 'detail', id] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: () => templatesApi.list(),
  })
}

export function useTemplate(id: number) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => templatesApi.get(id),
    enabled: id > 0,
  })
}

// ---------------------------------------------------------------------------
// Mutations - Template CRUD
// ---------------------------------------------------------------------------

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TemplateCreatePayload) => templatesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't create template. Check that the server is running and try again.", err.message)
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TemplateUpdatePayload }) =>
      templatesApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.list() })
      queryClient.setQueryData(templateKeys.detail(data.id), data)
    },
    onError: (err: Error) => {
      notify.error("Couldn't update template.", err.message)
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't delete template.", err.message)
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations - Template Task CRUD
// ---------------------------------------------------------------------------

export function useCreateTemplateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: TemplateTaskCreatePayload }) =>
      templatesApi.createTask(templateId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.templateId) })
      queryClient.invalidateQueries({ queryKey: templateKeys.list() })
    },
    onError: (err: Error) => {
      notify.error("Couldn't add task to template.", err.message)
    },
  })
}

export function useUpdateTemplateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: TemplateTaskUpdatePayload }) =>
      templatesApi.updateTask(taskId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(data.template_id) })
    },
    onError: (err: Error) => {
      notify.error("Couldn't update task.", err.message)
    },
  })
}

export function useDeleteTemplateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId }: { taskId: number; templateId: number }) =>
      templatesApi.deleteTask(taskId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.templateId) })
      queryClient.invalidateQueries({ queryKey: templateKeys.list() })
    },
    onError: (err: Error) => {
      notify.error("Couldn't delete task.", err.message)
    },
  })
}

export function useReorderTemplateTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, taskIds }: { templateId: number; taskIds: number[] }) =>
      templatesApi.reorderTasks(templateId, { task_ids: taskIds }),
    onMutate: async ({ templateId, taskIds }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: templateKeys.detail(templateId) })

      // Snapshot the previous value
      const previousTemplate = queryClient.getQueryData<TemplateDetail>(templateKeys.detail(templateId))

      // Optimistically update the cache
      if (previousTemplate) {
        const taskMap = new Map(previousTemplate.tasks.map(t => [t.id, t]))
        const reorderedTasks = taskIds
          .map(id => taskMap.get(id))
          .filter((t): t is TemplateTask => t !== undefined)
          .map((t, i) => ({ ...t, sort_order: i }))

        queryClient.setQueryData<TemplateDetail>(templateKeys.detail(templateId), {
          ...previousTemplate,
          tasks: reorderedTasks,
        })
      }

      return { previousTemplate }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTemplate) {
        queryClient.setQueryData(templateKeys.detail(variables.templateId), context.previousTemplate)
      }
      notify.error("Couldn't reorder tasks.", (err as Error).message)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.templateId) })
    },
  })
}

// ---------------------------------------------------------------------------
// Mutations - Create project from template
// ---------------------------------------------------------------------------

export function useCreateProjectFromTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: number; payload: CreateProjectFromTemplatePayload }) =>
      templatesApi.createProjectFromTemplate(templateId, payload),
    onSuccess: () => {
      // Invalidate projects list and dashboard
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      notify.success('Project created from template')
    },
    onError: (err: Error) => {
      notify.error("Couldn't create project from template.", err.message)
    },
  })
}
