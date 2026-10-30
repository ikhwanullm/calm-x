import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Project, ProjectStats } from '../types/models'

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../api/items', () => ({ itemsApi: { list: vi.fn() } }))
vi.mock('../components/items/NewItemDialog', () => ({ NewItemDialog: () => null }))

import { itemsApi } from '../api/items'
import ProjectsPage from '../pages/ProjectsPage'

const TODAY = '2026-10-29'

function stats(extra: Partial<ProjectStats> = {}): ProjectStats {
  return {
    open_task_count: 2, overdue_task_count: 0, waiting_task_count: 0, next_task: null,
    next_meeting_at: null, last_meeting_at: null, linked_resource_count: 0, project_count: 0,
    last_activity_at: new Date(2026, 9, 28, 10).toISOString(), ...extra,
  }
}

function project(id: number, title: string, extra: Partial<Project> = {}): Project {
  return {
    id, type: 'project', title, description: '', notes: '', archived_at: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    task_count: 4, completed_task_count: 1, progress_percentage: 25,
    project_goal: null, project_deadline: null, project_status: 'active', project_completed_at: null,
    area_id: null, area_title: null, area_archived: false, stats: stats(), ...extra,
  }
}

const AREA = { id: 3, type: 'area', title: 'Platform', archived_at: null }

const PROJECTS = [
  project(1, 'Migrate CML', {
    project_deadline: '2026-11-02', area_id: 3, area_title: 'Platform',
    stats: stats({
      overdue_task_count: 2, waiting_task_count: 1, linked_resource_count: 3,
      next_task: { id: 9, title: 'Send report', due_date: '2026-10-28' },
      next_meeting_at: new Date(2026, 9, 29, 15, 30).toISOString(),
    }),
  }),
  project(2, 'Alpha site', { project_deadline: '2026-10-30', stats: stats({ open_task_count: 0 }) }),
  project(3, 'No date project'),
  project(4, 'Finished one', { project_status: 'completed' }),
]

function Probe() {
  const l = useLocation()
  return <div data-testid="search">{l.search}</div>
}

function renderPage(url = '/projects') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={qc}><ProjectsPage /><Probe /></QueryClientProvider>
    </MemoryRouter>
  )
}

const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
const search = () => screen.getByTestId('search').textContent

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0))
    vi.mocked(itemsApi.list).mockImplementation(async (params) =>
      (params?.type === 'area' ? [AREA] : PROJECTS) as never)
  })
  afterEach(() => vi.useRealTimers())

  it('asks for projects with the local date, and sorts by nearest deadline by default', async () => {
    renderPage()
    await screen.findByText('Migrate CML')
    expect(itemsApi.list).toHaveBeenCalledWith({ type: 'project', today: TODAY })
    expect(titles()).toEqual(['Alpha site', 'Migrate CML', 'No date project'])  // the completed one is hidden
  })

  it('a card shows area, next task, overdue/waiting/meeting/resources, and a prompt when nothing is open', async () => {
    renderPage()
    const card = (await screen.findByText('Migrate CML')).closest('a') as HTMLElement
    expect(card.textContent).toContain('Platform')
    expect(card.textContent).toContain('updated yesterday')
    expect(card.textContent).toContain('Next: Send report')
    expect(card.textContent).toContain('Yesterday')
    expect(within(card).getByText('2 overdue')).toBeTruthy()
    expect(within(card).getByText('1 waiting')).toBeTruthy()
    expect(within(card).getByText('Meeting today 15:30')).toBeTruthy()
    expect(within(card).getByText('3 resources')).toBeTruthy()
    expect(within(card).getByRole('progressbar', { name: /progress/ })).toBeTruthy()
    const empty = screen.getByText('Alpha site').closest('a') as HTMLElement
    expect(empty.textContent).toContain('No open tasks. Add a next step or archive it.')
    expect(screen.getByText('No date project').closest('a')!.textContent).toContain('No deadline')
  })

  it('sorting, filters and search are written to the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Migrate CML')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'name')
    expect(search()).toBe('?sort=name')
    await user.click(screen.getByRole('button', { name: 'Has overdue' }))
    expect(search()).toContain('overdue=1')
    expect(titles()).toEqual(['Migrate CML'])
    await user.selectOptions(screen.getByRole('combobox', { name: 'All areas' }), '3')
    expect(search()).toContain('area=3')
    await user.click(screen.getByRole('button', { name: 'Completed' }))
    expect(search()).toContain('completed=1')
  })

  it('reads the state from the URL', async () => {
    renderPage('/projects?sort=name&deadline=none&q=date')
    await screen.findByText('No date project')
    expect(titles()).toEqual(['No date project'])
    expect((screen.getByRole('combobox', { name: 'Sort by' }) as HTMLSelectElement).value).toBe('name')
    expect((screen.getByRole('searchbox', { name: 'Search projects' }) as HTMLInputElement).value).toBe('date')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  it('typing in the search box updates the URL after a pause', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Migrate CML')
    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'alpha')
    await waitFor(() => expect(search()).toBe('?q=alpha'))
    expect(titles()).toEqual(['Alpha site'])
  })

  it('shows an empty result with Clear filters that resets everything', async () => {
    const user = userEvent.setup()
    renderPage('/projects?q=nothing-like-this&stale=1')
    expect(await screen.findByText('No projects match these filters.')).toBeTruthy()
    const clear = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clear[clear.length - 1])
    expect(search()).toBe('')
    expect(await screen.findByText('Migrate CML')).toBeTruthy()
  })

  it('switches to the compact list, which shows the columns and is remembered', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await screen.findByText('Migrate CML')
    expect(screen.getByRole('button', { name: 'Card view' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'List view' }))
    const table = screen.getByRole('table', { name: 'Projects' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Title', 'Area', 'Progress', 'Next task', 'Deadline', 'Overdue', 'Last activity'])
    const row = within(table).getByRole('link', { name: 'Migrate CML' }).closest('tr') as HTMLElement
    expect(row.textContent).toContain('Platform')
    expect(row.textContent).toContain('Send report')
    expect(row.textContent).toContain('updated yesterday')
    expect(within(table).getByRole('link', { name: 'Migrate CML' }).getAttribute('href')).toBe('/projects/1')
    first.unmount()
    renderPage()
    await screen.findByRole('table', { name: 'Projects' })
  })

  it('falls back to cards when storage is unavailable', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    renderPage()
    expect(await screen.findByText('Migrate CML')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    get.mockRestore()
  })

  it('shows the first-project prompt when there are none', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No projects yet')).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })
})
