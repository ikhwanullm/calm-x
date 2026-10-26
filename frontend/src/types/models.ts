/**
 * Frontend TypeScript interfaces for the Calm-X data model.
 * These mirror the backend Pydantic schemas exactly.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type ItemType = 'project' | 'area' | 'resource'
export type ProjectStatus = 'active' | 'completed'
export type Priority = 'high' | 'medium' | 'low'

// ---------------------------------------------------------------------------
// Item (base fields shared by all types)
// ---------------------------------------------------------------------------

interface ItemBase {
  id: number
  type: ItemType
  title: string
  description: string
  notes: string
  archived_at: string | null  // ISO datetime string or null
  created_at: string          // ISO datetime string
  updated_at: string          // ISO datetime string
  task_count: number
  completed_task_count: number
  progress_percentage: number
}

// ---------------------------------------------------------------------------
// Type-specific Item interfaces
// ---------------------------------------------------------------------------

export interface Project extends ItemBase {
  type: 'project'
  project_goal: string | null
  project_deadline: string | null  // YYYY-MM-DD date string or null
  project_status: ProjectStatus | null
  project_completed_at: string | null
}

export interface Area extends ItemBase {
  type: 'area'
  area_maintenance_notes: string | null
}

export interface Resource extends ItemBase {
  type: 'resource'
}

// Discriminated union for type-safe narrowing
export type Item = Project | Area | Resource

// ---------------------------------------------------------------------------
// Create/Update payloads (sent to API)
// ---------------------------------------------------------------------------

export interface ProjectCreatePayload {
  type: 'project'
  title: string
  description?: string
  notes?: string
  project_goal?: string | null
  project_deadline?: string | null
}

export interface AreaCreatePayload {
  type: 'area'
  title: string
  description?: string
  notes?: string
  area_maintenance_notes?: string | null
}

export interface ResourceCreatePayload {
  type: 'resource'
  title: string
  description?: string
  notes?: string
}

export type ItemCreatePayload = ProjectCreatePayload | AreaCreatePayload | ResourceCreatePayload

export interface ItemUpdatePayload {
  title?: string
  description?: string
  notes?: string
  project_goal?: string | null
  project_deadline?: string | null
  project_status?: ProjectStatus | null
  area_maintenance_notes?: string | null
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isProject(item: Item): item is Project {
  return item.type === 'project'
}

export function isArea(item: Item): item is Area {
  return item.type === 'area'
}

export function isResource(item: Item): item is Resource {
  return item.type === 'resource'
}

export function isArchived(item: Item): boolean {
  return item.archived_at !== null
}
