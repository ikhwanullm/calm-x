import { apiClient } from "./client"
import type {
  ReferenceLink,
  ResourceLink,
  LinkedItemSummary,
  TypeConversionPayload,
  TypeConversionPreview,
} from "../types/links"
import type { Item } from "../types/models"

export const linksApi = {
  // Reference links
  listLinks: (itemId: number) =>
    apiClient.get<ReferenceLink[]>(`/items/${itemId}/links`).then((r) => r.data),

  addLink: (itemId: number, url: string) =>
    apiClient.post<ReferenceLink>(`/items/${itemId}/links`, { url }).then((r) => r.data),

  deleteLink: (linkId: number) => apiClient.delete(`/links/${linkId}`),

  reorderLinks: (itemId: number, linkIds: number[]) =>
    apiClient
      .put<ReferenceLink[]>(`/items/${itemId}/links/reorder`, { link_ids: linkIds })
      .then((r) => r.data),

  // Resource links
  listLinkedItems: (resourceId: number) =>
    apiClient
      .get<LinkedItemSummary[]>(`/resources/${resourceId}/linked-items`)
      .then((r) => r.data),

  linkResource: (resourceId: number, linkedItemId: number) =>
    apiClient
      .post<ResourceLink>(`/resources/${resourceId}/link`, { linked_item_id: linkedItemId })
      .then((r) => r.data),

  unlinkResource: (resourceId: number, itemId: number) =>
    apiClient.delete(`/resources/${resourceId}/link/${itemId}`),

  // Type conversion
  previewConversion: (itemId: number, targetType: string) =>
    apiClient
      .get<TypeConversionPreview>(`/items/${itemId}/convert/preview`, {
        params: { target_type: targetType },
      })
      .then((r) => r.data),

  convert: (itemId: number, payload: TypeConversionPayload) =>
    apiClient.post<Item>(`/items/${itemId}/convert`, payload).then((r) => r.data),
}
