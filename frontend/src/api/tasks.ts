import { apiClient } from './client'
import type {
  Task,
  TaskCreatePayload,
  TaskMovePayload,
  TaskReorderPayload,
  TaskUpdatePayload,
} from '../types/models'

export const tasksApi = {
  list: (params?: {
    item_id?: number
    include_complete?: boolean
    tags?: string
    priorities?: string
    due_start?: string
    due_end?: string
    category?: string
    scope?: string
  }) =>
    apiClient.get<Task[]>('/tasks', { params }).then(r => r.data),

  inbox: () =>
    apiClient.get<Task[]>('/tasks/inbox').then(r => r.data),

  listForItem: (itemId: number, params?: { include_complete?: boolean }) =>
    apiClient.get<Task[]>(`/items/${itemId}/tasks`, { params }).then(r => r.data),

  get: (id: number) =>
    apiClient.get<Task>(`/tasks/${id}`).then(r => r.data),

  create: (payload: TaskCreatePayload) =>
    apiClient.post<Task>('/tasks', payload).then(r => r.data),

  update: (id: number, payload: TaskUpdatePayload) =>
    apiClient.put<Task>(`/tasks/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/tasks/${id}`),

  move: (id: number, payload: TaskMovePayload) =>
    apiClient.post<Task>(`/tasks/${id}/move`, payload).then(r => r.data),

  complete: (id: number) =>
    apiClient.post<Task>(`/tasks/${id}/complete`).then(r => r.data),

  incomplete: (id: number) =>
    apiClient.post<Task>(`/tasks/${id}/incomplete`).then(r => r.data),

  reorder: (itemId: number, payload: TaskReorderPayload) =>
    apiClient.put<Task[]>(`/items/${itemId}/tasks/reorder`, payload).then(r => r.data),
}
