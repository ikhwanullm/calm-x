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

// ---------------------------------------------------------------------------
// Task
// ---------------------------------------------------------------------------

export type TaskPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: number
  item_id: number | null
  title: string
  description: string
  notes: string
  due_date: string | null        // YYYY-MM-DD
  priority: TaskPriority
  is_complete: boolean
  sort_order: number
  created_at: string
  updated_at: string
  subtask_count: number
  completed_subtask_count: number
  tags: string[]
}

// Create/Update payloads
export interface TaskCreatePayload {
  title: string
  item_id?: number | null
  description?: string
  notes?: string
  due_date?: string | null
  priority?: TaskPriority
}

export interface TaskUpdatePayload {
  title?: string
  description?: string
  notes?: string
  due_date?: string | null
  priority?: TaskPriority
}

export interface TaskMovePayload {
  item_id: number | null
}

export interface TaskReorderPayload {
  task_ids: number[]
}

// ---------------------------------------------------------------------------
// Subtask
// ---------------------------------------------------------------------------

export interface Subtask {
  id: number
  task_id: number
  title: string
  is_complete: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SubtaskCreatePayload {
  title: string
}

export interface SubtaskUpdatePayload {
  title?: string
}

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

export interface Tag {
  id: number
  name: string
  created_at: string
}

export interface TagCreatePayload {
  name: string
}

export interface TagRenamePayload {
  name: string
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isComplete(task: Task): boolean {
  return task.is_complete
}
