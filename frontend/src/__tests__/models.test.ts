import { describe, it, expect } from 'vitest'
import { isProject, isArea, isResource, isArchived } from '../types/models'
import type { Project, Area, Resource, Item } from '../types/models'

const baseItem = {
  id: 1,
  title: 'Test',
  description: '',
  notes: '',
  archived_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  task_count: 0,
  completed_task_count: 0,
  progress_percentage: 0,
}

const project: Project = {
  ...baseItem,
  type: 'project',
  project_goal: null,
  project_deadline: null,
  project_status: 'active',
  project_completed_at: null,
  area_id: null,
  area_title: null,
  area_archived: false,
}

const area: Area = {
  ...baseItem,
  type: 'area',
  area_maintenance_notes: null,
}

const resource: Resource = {
  ...baseItem,
  type: 'resource',
}

describe('type guards', () => {
  it('isProject returns true for project', () => {
    expect(isProject(project)).toBe(true)
  })

  it('isProject returns false for area', () => {
    expect(isProject(area)).toBe(false)
  })

  it('isArea returns true for area', () => {
    expect(isArea(area)).toBe(true)
  })

  it('isResource returns true for resource', () => {
    expect(isResource(resource)).toBe(true)
  })

  it('isArchived returns false for active item', () => {
    expect(isArchived(project)).toBe(false)
  })

  it('isArchived returns true when archived_at is set', () => {
    const archived: Item = { ...project, archived_at: '2024-06-01T00:00:00Z' }
    expect(isArchived(archived)).toBe(true)
  })
})

describe('discriminated union narrowing', () => {
  it('narrowed project has project_goal', () => {
    const item: Item = project
    if (isProject(item)) {
      // TypeScript narrows to Project — project_goal is accessible
      expect(item.project_goal).toBeNull()
    } else {
      throw new Error('Should be project')
    }
  })

  it('narrowed area has area_maintenance_notes', () => {
    const item: Item = area
    if (isArea(item)) {
      expect(item.area_maintenance_notes).toBeNull()
    } else {
      throw new Error('Should be area')
    }
  })
})
