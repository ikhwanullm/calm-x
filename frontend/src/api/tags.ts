import { apiClient } from './client'
import type { Tag, TagCreatePayload, TagRenamePayload } from '../types/models'

export const tagsApi = {
  list: () => apiClient.get<Tag[]>('/tags').then(r => r.data),
  create: (payload: TagCreatePayload) => apiClient.post<Tag>('/tags', payload).then(r => r.data),
  rename: (id: number, payload: TagRenamePayload) =>
    apiClient.put<Tag>(`/tags/${id}`, payload).then(r => r.data),
  delete: (id: number) => apiClient.delete(`/tags/${id}`),
}
