export interface ReferenceLink {
  id: number
  item_id: number
  url: string
  sort_order: number
  created_at: string
}

export interface ResourceLink {
  id: number
  resource_id: number
  linked_item_id: number
  created_at: string
}

export interface LinkedItemSummary {
  id: number
  type: string
  title: string
  archived_at: string | null
}

export interface TypeConversionPayload {
  target_type: string
  project_goal?: string | null
  project_deadline?: string | null
  area_maintenance_notes?: string | null
}

export interface TypeConversionPreview {
  current_type: string
  target_type: string
  task_count: number
  open_task_count: number
  resource_link_count: number
}
