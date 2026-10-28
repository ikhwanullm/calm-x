import { apiClient } from './client'
import type {
  Template,
  TemplateDetail,
  TemplateTask,
  TemplateCreatePayload,
  TemplateUpdatePayload,
  TemplateTaskCreatePayload,
  TemplateTaskUpdatePayload,
  TemplateTaskReorderPayload,
  CreateProjectFromTemplatePayload,
  Project,
} from '../types/models'

export const templatesApi = {
  list: () =>
    apiClient.get<Template[]>('/templates/').then(r => r.data),

  get: (id: number) =>
    apiClient.get<TemplateDetail>(`/templates/${id}`).then(r => r.data),

  create: (payload: TemplateCreatePayload) =>
    apiClient.post<TemplateDetail>('/templates/', payload).then(r => r.data),

  update: (id: number, payload: TemplateUpdatePayload) =>
    apiClient.put<TemplateDetail>(`/templates/${id}`, payload).then(r => r.data),

  delete: (id: number) =>
    apiClient.delete(`/templates/${id}`),

  createProjectFromTemplate: (templateId: number, payload: CreateProjectFromTemplatePayload) =>
    apiClient.post<Project>(`/templates/${templateId}/create-project`, payload).then(r => r.data),

  // Template task operations
  createTask: (templateId: number, payload: TemplateTaskCreatePayload) =>
    apiClient.post<TemplateTask>(`/templates/${templateId}/tasks`, payload).then(r => r.data),

  updateTask: (taskId: number, payload: TemplateTaskUpdatePayload) =>
    apiClient.put<TemplateTask>(`/templates/tasks/${taskId}`, payload).then(r => r.data),

  deleteTask: (taskId: number) =>
    apiClient.delete(`/templates/tasks/${taskId}`),

  reorderTasks: (templateId: number, payload: TemplateTaskReorderPayload) =>
    apiClient.put<TemplateTask[]>(`/templates/${templateId}/tasks/reorder`, payload).then(r => r.data),
}
