import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from '../types/models'

vi.mock('../api/tasks', () => ({
  tasksApi: { list: vi.fn(), complete: vi.fn().mockResolvedValue({}), incomplete: vi.fn().mockResolvedValue({}) },
}))
vi.mock('../api/tags', () => ({ tagsApi: { list: vi.fn().mockResolvedValue([]) } }))
vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../components/tasks/TaskDrawer', () => ({ TaskDrawer: () => null }))

import { tasksApi } from '../api/tasks'
import AllTasksPage from '../pages/AllTasksPage'

const TODAY = '2026-10-29'

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: 0, created_at: '', updated_at: '', subtask_count: 0,
    completed_subtask_count: 0, tags: [], focus_date: null, waiting_for: null, waiting_since: null, defer_until: null,
    is_someday: false, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

const TASKS = [
  task(1, 'Send report', { item_id: 5, item_title: 'Migrate CML', due_date: '2026-10-28', priority: 'high', tags: ['work'] }),
  task(2, 'Reply to Budi', { item_id: 5, item_title: 'Migrate CML', waiting_for: 'Budi', meeting_id: 3 }),
  task(3, 'Buy milk', { due_date: '2026-11-20', is_complete: true }),
]

function Probe() {
  const l = useLocation()
  return <div data-testid="search">{l.search}</div>
}

function renderPage(url = '/tasks') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={qc}><AllTasksPage /><Probe /></QueryClientProvider>
    </MemoryRouter>
  )
}

const search = () => screen.getByTestId('search').textContent
const lastQuery = () => vi.mocked(tasksApi.list).mock.calls[vi.mocked(tasksApi.list).mock.calls.length - 1]?.[0]

describe('All tasks page: search, sort, group and view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0))
    vi.mocked(tasksApi.list).mockResolvedValue(TASKS)
  })
  afterEach(() => vi.useRealTimers())

  it('asks for open tasks sorted by due date, hiding Someday and not-yet-started ones', async () => {
    renderPage()
    await screen.findByText('Send report')
    expect(lastQuery()).toMatchObject({
      scope: 'all', status: 'open', sort: 'due', someday: false, deferred: false, today: TODAY,
    })
    expect(lastQuery()).not.toHaveProperty('waiting', true)
  })

  it('the state chips ask for only those tasks and are kept in the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Send report')
    await user.click(screen.getByRole('button', { name: 'Waiting' }))
    await user.click(screen.getByRole('button', { name: 'Someday' }))
    expect(search()).toContain('waiting=1')
    expect(search()).toContain('someday=1')
    await waitFor(() => expect(lastQuery()).toMatchObject({ waiting: true, someday: true, deferred: false }))
    await user.click(screen.getByRole('button', { name: 'From a meeting' }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ from_meeting: true }))
  })

  it('status, sort and group go to the server and the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Send report')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'all')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'priority')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Group by' }), 'project')
    expect(search()).toContain('status=all')
    expect(search()).toContain('sort=priority')
    expect(search()).toContain('group=project')
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: 'all', sort: 'priority' }))
  })

  it('reads the state from the URL and keeps the drawer param when other things change', async () => {
    const user = userEvent.setup()
    renderPage('/tasks?q=report&status=completed&sort=project&group=due&task=1')
    await screen.findByText('Send report')
    expect(lastQuery()).toMatchObject({ q: 'report', status: 'completed', sort: 'project' })
    expect((screen.getByRole('searchbox', { name: 'Search tasks' }) as HTMLInputElement).value).toBe('report')
    await user.click(screen.getByRole('button', { name: 'Waiting' }))
    expect(search()).toContain('task=1')
  })

  it('groups by project with counts and lets a group collapse', async () => {
    const user = userEvent.setup()
    renderPage('/tasks?group=project')
    const group = await screen.findByRole('region', { name: 'Migrate CML' })
    expect(within(group).getByText('Send report')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Inbox' })).toBeTruthy()
    const header = within(group).getByRole('button', { name: /Migrate CML/ })
    expect(header.textContent).toContain('2')
    await user.click(header)
    expect(within(group).queryByText('Send report')).toBeNull()
    expect(header.getAttribute('aria-expanded')).toBe('false')
    await user.click(header)
    expect(within(group).getByText('Send report')).toBeTruthy()
  })

  it('the compact list shows project, due, priority, tags and state chips, and remembers the choice', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await screen.findByText('Send report')
    await user.click(screen.getByRole('button', { name: 'List view' }))
    const table = screen.getByRole('table', { name: 'Filtered tasks' })
    const row = within(table).getByText('Send report').closest('tr') as HTMLElement
    expect(row.textContent).toContain('Migrate CML')
    expect(row.textContent).toContain('Yesterday')
    expect(row.textContent).toContain('work')
    const waiting = within(table).getByText('Reply to Budi').closest('tr') as HTMLElement
    expect(waiting.textContent).toContain('Waiting · Budi')
    expect(waiting.textContent).toContain('From a meeting')
    expect(within(table).getByText('Buy milk').closest('tr')!.textContent).toContain('Inbox')
    first.unmount()
    renderPage()
    await screen.findByRole('table', { name: 'Filtered tasks' })
  })

  it('completing a task from the compact list calls the API', async () => {
    const user = userEvent.setup()
    localStorage.setItem('calmx.view.tasks', 'list')
    renderPage()
    await user.click(await screen.findByRole('checkbox', { name: 'Mark complete: Send report' }))
    await waitFor(() => expect(tasksApi.complete).toHaveBeenCalledWith(1))
  })

  it('Clear filters resets search, status and chips but keeps sort and group', async () => {
    const user = userEvent.setup()
    renderPage('/tasks?q=nothing&status=all&waiting=1&sort=priority&group=project')
    await screen.findByText('Send report')
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(search()).toBe('?sort=priority&group=project')
  })

  it('shows the empty state when nothing matches', async () => {
    vi.mocked(tasksApi.list).mockResolvedValue([])
    renderPage('/tasks?q=zzz')
    expect(await screen.findByText('No matching tasks found.')).toBeTruthy()
  })
})
