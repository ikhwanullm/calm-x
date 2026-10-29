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

export interface NextTask {
  id: number
  title: string
  due_date: string | null
}

/** Sent with the Projects list when it is asked for with `today`. */
export interface ProjectStats {
  open_task_count: number
  overdue_task_count: number
  waiting_task_count: number
  next_task: NextTask | null
  next_meeting_at: string | null   // ISO datetime (UTC)
  last_meeting_at: string | null
  linked_resource_count: number
  last_activity_at: string         // ISO datetime (UTC)
}

export interface Project extends ItemBase {
  type: 'project'
  project_goal: string | null
  project_deadline: string | null  // YYYY-MM-DD date string or null
  project_status: ProjectStatus | null
  project_completed_at: string | null
  area_id: number | null
  area_title: string | null
  area_archived: boolean
  stats?: ProjectStats | null
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
  area_id?: number | null
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
  area_id?: number | null
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
  focus_date: string | null      // YYYY-MM-DD local date it was put on Today
  waiting_for: string | null     // who or what the task waits on
  waiting_since: string | null   // ISO datetime (UTC)
  defer_until: string | null     // YYYY-MM-DD local date the task starts
  is_someday: boolean            // parked idea
  meeting_id: number | null      // meeting the task was created from
  meeting_title: string | null
  meeting_held_at: string | null // ISO datetime (UTC)
  item_title: string | null
  item_type: ItemType | null
}

/** Open tasks for the Today view; each task is in at most one list. */
export interface CalendarDay {
  date: string                   // YYYY-MM-DD
  meetings: MeetingSummary[]
  due: Task[]
  planned: Task[]                // only in today's column
  deadlines: { id: number; title: string }[]
  starts: Task[]
}

export interface CalendarWeek {
  days: CalendarDay[]            // seven, Monday first
}

export interface TodayTasks {
  overdue: Task[]
  due_today: Task[]
  focused: Task[]
  waiting: Task[]
}

// Create/Update payloads
export interface TaskCreatePayload {
  title: string
  item_id?: number | null
  description?: string
  notes?: string
  due_date?: string | null
  priority?: TaskPriority
  tag_names?: string[]
}

export interface TaskUpdatePayload {
  title?: string
  description?: string
  notes?: string
  due_date?: string | null
  priority?: TaskPriority
  tag_names?: string[]
  focus_date?: string | null
  waiting_for?: string | null
  defer_until?: string | null
  is_someday?: boolean
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

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface TemplateTask {
  id: number
  template_id: number
  title: string
  description: string
  priority: Priority
  relative_days: number
  sort_order: number
}

export interface Template {
  id: number
  title: string
  description: string
  task_count: number
  created_at: string
  updated_at: string
}

export interface TemplateDetail extends Template {
  tasks: TemplateTask[]
}

// Create/Update payloads
export interface TemplateTaskCreatePayload {
  title: string
  description?: string
  priority?: Priority
  relative_days?: number
}

export interface TemplateTaskUpdatePayload {
  title?: string
  description?: string
  priority?: Priority
  relative_days?: number
}

export interface TemplateCreatePayload {
  title: string
  description?: string
  tasks?: TemplateTaskCreatePayload[]
}

export interface TemplateUpdatePayload {
  title?: string
  description?: string
}

export interface CreateProjectFromTemplatePayload {
  title: string
  start_date?: string  // YYYY-MM-DD
  project_goal?: string | null
  project_deadline?: string | null  // YYYY-MM-DD
  area_id?: number | null
}

export interface TemplateTaskReorderPayload {
  task_ids: number[]
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

/** A meeting without its notes, for lists. */
export interface MeetingSummary {
  id: number
  item_id: number
  item_title: string
  item_type: ItemType
  item_archived: boolean
  title: string
  held_at: string                // ISO datetime (UTC)
  attendees: string
  processed_at: string | null
  updated_at: string
  open_action_count: number      // `[ ]` and `@Who:` lines not yet turned into tasks
}

export interface MeetingCarryOver {
  meeting_id: number
  title: string
  held_at: string
  questions: string[]
  open_tasks: { id: number; title: string; waiting_for: string | null }[]
}

export interface Meeting extends MeetingSummary {
  body: string                   // Markdown
  created_at: string
}

export interface MeetingCreatePayload {
  title: string
  held_at: string
  attendees?: string
  body?: string
}

export interface MeetingUpdatePayload {
  title?: string
  held_at?: string
  attendees?: string
  body?: string
}

export interface MeetingActionLine {
  line: number                   // 0-based line in the notes
  kind: 'mine' | 'waiting'
  text: string
  who: string | null
}

export interface MeetingTextLine {
  line: number
  text: string
}

/** What the server finds in the notes right now. */
export interface MeetingActions {
  actions: MeetingActionLine[]
  questions: MeetingTextLine[]
  decisions: MeetingTextLine[]
  converted: number
}

export interface ProcessActionPayload {
  line: number
  text: string
  due_date?: string | null
  priority?: TaskPriority
}

export interface ProcessResult {
  created: Task[]
  meeting: Meeting
}
