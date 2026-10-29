import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '@/hooks/useItems'
import { useUrlParams } from '@/hooks/useUrlParams'
import { useViewMode } from '@/hooks/useViewMode'
import { ListToolbar } from '@/components/lists/ListToolbar'
import type { ToolbarChip } from '@/components/lists/ListToolbar'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectList } from '@/components/projects/ProjectList'
import { NewItemDialog } from '@/components/items/NewItemDialog'
import { EmptyState, Skeleton, SkeletonGroup } from '@/components/common'
import { getLocalToday } from '@/utils/date'
import {
  DEADLINE_FILTERS, PROJECT_SORTS, filterProjects, isDeadlineFilter, isSortValue, sortProjects,
} from '@/utils/projectList'
import type { ProjectFilters } from '@/utils/projectList'
import { isProject, isArchived } from '@/types/models'

export default function ProjectsPage() {
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()
  const today = getLocalToday()
  const url = useUrlParams()
  const [view, setView] = useViewMode('projects')

  const { data: items, isLoading, isError } = useItems({ type: 'project', today })
  const { data: areas = [] } = useItems({ type: 'area' })

  // Everything below lives in the query string, so it can be shared and survives a refresh.
  const sortParam = url.get('sort')
  const sort = isSortValue(sortParam) ? sortParam : 'deadline'
  const deadlineParam = url.get('deadline')
  const filters: ProjectFilters = {
    q: url.get('q'),
    active: url.get('active') !== '0',
    completed: url.get('completed') === '1',
    area: url.get('area'),
    deadline: isDeadlineFilter(deadlineParam) ? deadlineParam : '',
    hasOverdue: url.get('overdue') === '1',
    stale: url.get('stale') === '1',
  }
  const hasActiveFilters = filters.q !== '' || !filters.active || filters.completed || filters.area !== ''
    || filters.deadline !== '' || filters.hasOverdue || filters.stale

  const chips: ToolbarChip[] = [
    { kind: 'toggle', id: 'active', label: 'Active', pressed: filters.active, onToggle: () => url.set({ active: filters.active ? '0' : null }) },
    { kind: 'toggle', id: 'completed', label: 'Completed', pressed: filters.completed, onToggle: () => url.set({ completed: filters.completed ? null : '1' }) },
    {
      kind: 'select', id: 'area', label: 'All areas', value: filters.area, onChange: (v) => url.set({ area: v }),
      options: [{ value: '', label: 'All areas' }, { value: 'none', label: 'No area' }, ...areas.map((a) => ({ value: String(a.id), label: a.title }))],
    },
    {
      kind: 'select', id: 'deadline', label: 'Deadline: any', value: filters.deadline, onChange: (v) => url.set({ deadline: v }),
      options: DEADLINE_FILTERS,
    },
    { kind: 'toggle', id: 'overdue', label: 'Has overdue', pressed: filters.hasOverdue, onToggle: () => url.set({ overdue: filters.hasOverdue ? null : '1' }) },
    { kind: 'toggle', id: 'stale', label: 'Stale 30+ days', pressed: filters.stale, onToggle: () => url.set({ stale: filters.stale ? null : '1' }) },
  ]

  const header = (
    <div className="flex items-center justify-between gap-3 mb-6">
      <h1 className="text-2xl font-semibold text-text">Projects</h1>
      <button
        type="button"
        onClick={() => setShowNew(true)}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-control bg-accent text-accent-fg text-sm font-medium hover:opacity-90"
      >
        + New project
      </button>
    </div>
  )

  const projects = (items ?? []).filter((i) => isProject(i) && !isArchived(i)).filter(isProject)
  const shown = sortProjects(filterProjects(projects, filters, today), sort)

  let body: React.ReactNode
  if (isLoading) {
    body = (
      <SkeletonGroup label="Loading projects">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full mb-3" delay={0} />)}
      </SkeletonGroup>
    )
  } else if (isError) {
    body = (
      <p className="text-sm text-danger-fg">
        Couldn&apos;t load projects. Check that the server is running and try again.
      </p>
    )
  } else if (projects.length === 0) {
    body = (
      <EmptyState
        title="No projects yet"
        description="Create your first project to start tracking progress."
        action={{ label: 'New project', onClick: () => setShowNew(true) }}
        dashedBorder
      />
    )
  } else if (shown.length === 0) {
    body = (
      <div className="text-sm text-muted">
        <p>No projects match these filters.</p>
        <button
          type="button"
          onClick={() => url.set({ q: null, active: null, completed: null, area: null, deadline: null, overdue: null, stale: null })}
          className="mt-1 text-accent-text underline underline-offset-2"
        >
          Clear filters
        </button>
      </div>
    )
  } else if (view === 'list') {
    body = <ProjectList projects={shown} today={today} />
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {shown.map((p) => <ProjectCard key={p.id} project={p} today={today} />)}
      </div>
    )
  }

  return (
    <div>
      {header}
      {!isLoading && !isError && projects.length > 0 && (
        <ListToolbar
          searchValue={filters.q}
          onSearchChange={(q) => url.set({ q })}
          searchLabel="Search projects"
          sort={{ value: sort, options: PROJECT_SORTS, onChange: (v) => url.set({ sort: v === 'deadline' ? null : v }) }}
          chips={chips}
          view={{ value: view, onChange: setView }}
          hasActiveFilters={hasActiveFilters}
          onClear={() => url.set({ q: null, active: null, completed: null, area: null, deadline: null, overdue: null, stale: null })}
        />
      )}
      {body}
      <NewItemDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="project"
        onCreated={(id) => { setShowNew(false); navigate(`/projects/${id}`) }}
      />
    </div>
  )
}
