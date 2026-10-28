import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))

vi.mock('../api/items', () => ({
  itemsApi: { list: vi.fn() },
}))

import { itemsApi } from '../api/items'
import type { Project } from '../types/models'
import { ProjectAreaField } from '../components/items/ProjectAreaField'
import { AreaProjectsSection } from '../components/items/AreaProjectsSection'
import { ItemListView } from '../components/items/ItemListView'

const AREAS = [
  { id: 3, type: 'area', title: 'Platform', archived_at: null },
  { id: 4, type: 'area', title: 'Health', archived_at: null },
]

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1, type: 'project', title: 'Migrate CML', description: '', notes: '',
    archived_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    task_count: 2, completed_task_count: 1, progress_percentage: 50,
    project_goal: null, project_deadline: null, project_status: 'active', project_completed_at: null,
    area_id: null, area_title: null, area_archived: false,
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.search}</div>
}

function renderWithClient(ui: React.ReactNode, initialPath = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="*" element={<>{ui}<LocationProbe /></>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(itemsApi.list).mockImplementation(async (params) => {
    if (params?.type === 'area') return AREAS as never
    return [] as never
  })
})

describe('ProjectAreaField', () => {
  it('links to the parent area', () => {
    renderWithClient(
      <ProjectAreaField project={project({ area_id: 3, area_title: 'Platform' })} disabled={false} onChange={vi.fn()} />
    )
    expect(screen.getByRole('link', { name: 'Platform' }).getAttribute('href')).toBe('/areas/3')
    expect(screen.getByRole('button', { name: 'Change area' })).toBeTruthy()
  })

  it('adds a project to an area', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithClient(<ProjectAreaField project={project()} disabled={false} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '+ Add to an area' }))
    const select = screen.getByLabelText('Project area')
    await screen.findByRole('option', { name: 'Health' })
    await user.selectOptions(select, '4')
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('removes a project from its area', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderWithClient(
      <ProjectAreaField project={project({ area_id: 3, area_title: 'Platform' })} disabled={false} onChange={onChange} />
    )
    await user.click(screen.getByRole('button', { name: 'Change area' }))
    await screen.findByRole('option', { name: 'Platform' })
    await user.selectOptions(screen.getByLabelText('Project area'), '')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('marks an archived area and hides editing when disabled', () => {
    renderWithClient(
      <ProjectAreaField
        project={project({ area_id: 3, area_title: 'Platform', area_archived: true })}
        disabled
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('(Archived)')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /area/i })).toBeNull()
  })
})

describe('AreaProjectsSection', () => {
  it('lists the projects of the area with progress', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([
      project({ id: 7, title: 'Migrate CML', area_id: 3 }),
      project({ id: 8, title: 'Old work', area_id: 3, project_status: 'completed' }),
    ] as never)
    renderWithClient(<AreaProjectsSection areaId={3} isArchived={false} />)
    const link = await screen.findByRole('link', { name: 'Migrate CML' })
    expect(link.getAttribute('href')).toBe('/projects/7')
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()
    expect(itemsApi.list).toHaveBeenCalledWith({ type: 'project', area_id: 3 })
  })

  it('shows an empty state', async () => {
    renderWithClient(<AreaProjectsSection areaId={3} isArchived={false} />)
    expect(await screen.findByText(/No projects in this area yet/)).toBeTruthy()
  })
})

describe('Projects list area filter', () => {
  function renderList(path = '/projects') {
    vi.mocked(itemsApi.list).mockImplementation(async (params) => {
      if (params?.type === 'area') return AREAS as never
      return [
        project({ id: 1, title: 'In Platform', area_id: 3, area_title: 'Platform' }),
        project({ id: 2, title: 'In Health', area_id: 4, area_title: 'Health' }),
        project({ id: 3, title: 'No area project' }),
      ] as never
    })
    return renderWithClient(
      <ItemListView
        type="project" title="Projects" emptyTitle="None" emptyDescription="" newItemLabel="New project"
        onNew={() => {}} basePath="/projects"
      />,
      path
    )
  }

  it('shows the area name on project cards', async () => {
    renderList()
    await screen.findByText('In Platform')
    expect(screen.getAllByText('Platform').length).toBeGreaterThan(0)
  })

  it('filters by area and keeps the filter in the URL', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('In Platform')
    await screen.findByRole('option', { name: 'Health' })
    await user.selectOptions(screen.getByLabelText('Filter projects by area'), '4')
    await waitFor(() => expect(screen.queryByText('In Platform')).toBeNull())
    expect(screen.getByText('In Health')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('?area=4')
  })

  it('can show only projects without an area', async () => {
    renderList('/projects?area=none')
    expect(await screen.findByText('No area project')).toBeTruthy()
    expect(screen.queryByText('In Platform')).toBeNull()
    expect(screen.queryByText('In Health')).toBeNull()
  })
})
