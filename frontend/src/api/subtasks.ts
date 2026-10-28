import { apiClient } from './client'
import type { Subtask, SubtaskCreatePayload, SubtaskUpdatePayload } from '../types/models'

export const subtasksApi = {
  list: (taskId: number) =>
    apiClient.get<Subtask[]>(`/tasks/${taskId}/subtasks`).then(r => r.data),

  create: (taskId: number, payload: SubtaskCreatePayload) =>
    apiClient.post<Subtask>(`/tasks/${taskId}/subtasks`, payload).then(r => r.data),

  update: (id: number, payload: SubtaskUpdatePayload) =>
    apiClient.put<Subtask>(`/subtasks/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/subtasks/${id}`),

  restore: (id: number) =>
    apiClient.post<Subtask>(`/subtasks/${id}/restore`).then(r => r.data),

  complete: (id: number) =>
    apiClient.post<Subtask>(`/subtasks/${id}/complete`).then(r => r.data),

  incomplete: (id: number) =>
    apiClient.post<Subtask>(`/subtasks/${id}/incomplete`).then(r => r.data),
}
