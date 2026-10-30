import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Area, ProjectStats, Resource } from '../types/models'

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../api/items', () => ({ itemsApi: { list: vi.fn() } }))
vi.mock('../components/items/NewItemDialog', () => ({ NewItemDialog: () => null }))

import { itemsApi } from '../api/items'
import AreasPage from '../pages/AreasPage'
import ResourcesPage from '../pages/ResourcesPage'

const TODAY = '2026-10-29'

function stats(extra: Partial<ProjectStats> = {}): ProjectStats {
  return {
    open_task_count: 0, overdue_task_count: 0, waiting_task_count: 0, next_task: null, next_meeting_at: null,
    last_meeting_at: null, linked_resource_count: 0, project_count: 0,
    last_activity_at: new Date(2026, 9, 28, 10).toISOString(), ...extra,
  }
}

const base = { description: '', notes: '', archived_at: null, created_at: '2026-10-01T00:00:00Z', task_count: 0, completed_task_count: 0, progress_percentage: 0 }

const AREAS: Area[] = [
  {
    ...base, id: 1, type: 'area', title: 'Work', updated_at: '2026-10-28T00:00:00Z', area_maintenance_notes: null,
    stats: stats({
      project_count: 3, open_task_count: 5, overdue_task_count: 2, waiting_task_count: 1, linked_resource_count: 2,
      next_task: { id: 7, title: 'Send invoice', due_date: '2026-10-28' },
    }),
  },
  { ...base, id: 2, type: 'area', title: 'Health', updated_at: '2026-09-01T00:00:00Z', area_maintenance_notes: null,
    stats: stats({ last_activity_at: new Date(2026, 8, 1, 10).toISOString() }) },
]

const RESOURCES: Resource[] = [
  { ...base, id: 1, type: 'resource', title: 'Style guide', description: 'Writing rules', updated_at: new Date(2026, 9, 28).toISOString(),
    stats: { reference_link_count: 2, linked_item_count: 3 } },
  { ...base, id: 2, type: 'resource', title: 'Old notes', updated_at: new Date(2026, 5, 1).toISOString(),
    stats: { reference_link_count: 0, linked_item_count: 0 } },
]

function Probe() {
  const l = useLocation()
  return <div data-testid="search">{l.search}</div>
}

function renderPage(page: React.ReactNode, url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={qc}>{page}<Probe /></QueryClientProvider>
    </MemoryRouter>
  )
}

const headings = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
const search = () => screen.getByTestId('search').textContent

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0))
})
afterEach(() => vi.useRealTimers())

describe('AreasPage', () => {
  beforeEach(() => vi.mocked(itemsApi.list).mockResolvedValue(AREAS as never))

  it('asks for areas with the local date and lists them by name', async () => {
    renderPage(<AreasPage />, '/areas')
    await screen.findByText('Work')
    expect(itemsApi.list).toHaveBeenCalledWith({ type: 'area', today: TODAY })
    expect(headings()).toEqual(['Health', 'Work'])
  })

  it('a card shows projects, open tasks, activity, next task and the overdue/waiting/resource chips', async () => {
    renderPage(<AreasPage />, '/areas')
    const card = (await screen.findByText('Work')).closest('a') as HTMLElement
    expect(card.getAttribute('href')).toBe('/areas/1')
    expect(card.textContent).toContain('3 projects · 5 open tasks · updated yesterday')
    expect(card.textContent).toContain('Next: Send invoice')
    expect(within(card).getByText('2 overdue')).toBeTruthy()
    expect(within(card).getByText('1 waiting')).toBeTruthy()
    expect(within(card).getByText('2 resources')).toBeTruthy()
    expect(screen.getByText('Health').closest('a')!.textContent).toContain('no activity for 58 days')
  })

  it('sort and filters go to the URL and are read back from it', async () => {
    const user = userEvent.setup()
    renderPage(<AreasPage />, '/areas')
    await screen.findByText('Work')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'overdue')
    expect(search()).toBe('?sort=overdue')
    expect(headings()).toEqual(['Work', 'Health'])
    await user.click(screen.getByRole('button', { name: 'Stale 30+ days' }))
    expect(search()).toContain('stale=1')
    expect(headings()).toEqual(['Health'])
  })

  it('reads state from the URL, shows an empty result and clears it', async () => {
    const user = userEvent.setup()
    renderPage(<AreasPage />, '/areas?q=nothing&overdue=1')
    expect(await screen.findByText('No areas match these filters.')).toBeTruthy()
    const clear = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clear[clear.length - 1])
    expect(search()).toBe('')
    expect(await screen.findByText('Work')).toBeTruthy()
  })

  it('the compact list has the columns and remembers the choice', async () => {
    const user = userEvent.setup()
    const first = renderPage(<AreasPage />, '/areas')
    await screen.findByText('Work')
    await user.click(screen.getByRole('button', { name: 'List view' }))
    const table = screen.getByRole('table', { name: 'Areas' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Title', 'Projects', 'Open tasks', 'Overdue', 'Next task', 'Last activity'])
    const row = within(table).getByRole('link', { name: 'Work' }).closest('tr') as HTMLElement
    expect(row.textContent).toContain('Send invoice')
    first.unmount()
    renderPage(<AreasPage />, '/areas')
    await screen.findByRole('table', { name: 'Areas' })
  })

  it('shows the first-area prompt when there are none', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([])
    renderPage(<AreasPage />, '/areas')
    expect(await screen.findByText('No areas yet')).toBeTruthy()
  })
})

describe('ResourcesPage', () => {
  beforeEach(() => vi.mocked(itemsApi.list).mockResolvedValue(RESOURCES as never))

  it('asks for resources with the local date and lists them by name', async () => {
    renderPage(<ResourcesPage />, '/resources')
    await screen.findByText('Style guide')
    expect(itemsApi.list).toHaveBeenCalledWith({ type: 'resource', today: TODAY })
    expect(headings()).toEqual(['Old notes', 'Style guide'])
  })

  it('a card shows links, what it is used by, and when it was last touched', async () => {
    renderPage(<ResourcesPage />, '/resources')
    const used = (await screen.findByText('Style guide')).closest('a') as HTMLElement
    expect(used.textContent).toContain('Writing rules')
    expect(used.textContent).toContain('2 links')
    expect(used.textContent).toContain('Used by 3 projects and areas')
    expect(used.textContent).toContain('updated yesterday')
    const lonely = screen.getByText('Old notes').closest('a') as HTMLElement
    expect(lonely.textContent).toContain('0 links')
    expect(lonely.textContent).toContain('Not linked to anything')
    expect(lonely.textContent).toContain('not updated for 150 days')
  })

  it('"Not linked" and sorting by most used work through the URL', async () => {
    const user = userEvent.setup()
    renderPage(<ResourcesPage />, '/resources')
    await screen.findByText('Style guide')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'used')
    expect(headings()).toEqual(['Style guide', 'Old notes'])
    await user.click(screen.getByRole('button', { name: 'Not linked' }))
    expect(search()).toContain('unlinked=1')
    expect(headings()).toEqual(['Old notes'])
  })

  it('the compact list shows links and linked-to counts', async () => {
    const user = userEvent.setup()
    renderPage(<ResourcesPage />, '/resources')
    await screen.findByText('Style guide')
    await user.click(screen.getByRole('button', { name: 'List view' }))
    const table = screen.getByRole('table', { name: 'Resources' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Title', 'Description', 'Links', 'Linked to', 'Updated'])
    expect(within(table).getByRole('link', { name: 'Style guide' }).getAttribute('href')).toBe('/resources/1')
  })

  it('shows an empty result with Clear filters, and the first-resource prompt when there are none', async () => {
    renderPage(<ResourcesPage />, '/resources?q=zzz')
    expect(await screen.findByText('No resources match these filters.')).toBeTruthy()
  })

  it('first-resource prompt', async () => {
    vi.mocked(itemsApi.list).mockResolvedValue([])
    renderPage(<ResourcesPage />, '/resources')
    expect(await screen.findByText('No resources yet')).toBeTruthy()
  })
})
