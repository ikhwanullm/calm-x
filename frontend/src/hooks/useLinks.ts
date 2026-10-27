import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { linksApi } from "../api/links"
import { itemKeys } from "./useItems"
import { taskKeys } from "./useTasks"
import { dashboardKeys } from "./useDashboard"
import { notify } from "../lib/toast"
import type { TypeConversionPayload } from "../types/links"
import { useNavigate } from "react-router-dom"

export const linkKeys = {
  forItem: (itemId: number) => ["links", "item", itemId] as const,
  linkedItems: (resourceId: number) => ["links", "resource", resourceId] as const,
}

// Reference links

export function useReferenceLinks(itemId: number) {
  return useQuery({
    queryKey: linkKeys.forItem(itemId),
    queryFn: () => linksApi.listLinks(itemId),
    enabled: itemId > 0,
  })
}

export function useAddReferenceLink(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => linksApi.addLink(itemId, url),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.forItem(itemId) }),
    onError: (err: Error) => notify.error("Could not add link.", err.message),
  })
}

export function useReorderReferenceLinks(itemId: number) {
  return useMutation({
    mutationFn: (linkIds: number[]) => linksApi.reorderLinks(itemId, linkIds),
    onError: (err: Error) => notify.error("Could not reorder links.", err.message),
  })
}

export function useDeleteReferenceLink(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkId: number) => linksApi.deleteLink(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.forItem(itemId) }),
    onError: (err: Error) => notify.error("Could not remove link.", err.message),
  })
}

// Resource links

export function useLinkedItems(resourceId: number) {
  return useQuery({
    queryKey: linkKeys.linkedItems(resourceId),
    queryFn: () => linksApi.listLinkedItems(resourceId),
    enabled: resourceId > 0,
  })
}

export function useLinkResource(resourceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linkedItemId: number) => linksApi.linkResource(resourceId, linkedItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.linkedItems(resourceId) }),
    onError: (err: Error) => notify.error("Could not link item.", err.message),
  })
}

export function useUnlinkResource(resourceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => linksApi.unlinkResource(resourceId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: linkKeys.linkedItems(resourceId) }),
    onError: (err: Error) => notify.error("Could not unlink item.", err.message),
  })
}

// Type conversion

export function useConvertItem() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: TypeConversionPayload }) =>
      linksApi.convert(itemId, payload),
    onSuccess: (updatedItem) => {
      const labels: Record<string, string> = { project: "Project", area: "Area", resource: "Resource" }
      notify.success(`Converted to ${labels[updatedItem.type] ?? updatedItem.type}`)
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
      // Navigate to the new type route
      const typeRoutes: Record<string, string> = {
        project: "projects",
        area: "areas",
        resource: "resources",
      }
      const route = typeRoutes[updatedItem.type]
      if (route) navigate(`/${route}/${updatedItem.id}`)
    },
    onError: (err: Error) => notify.error("Could not convert item.", err.message),
  })
}
