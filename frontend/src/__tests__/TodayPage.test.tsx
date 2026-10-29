import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from '../types/models'

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../components/tasks/TaskDrawer', () => ({ TaskDrawer: () => null }))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../api/tasks', () => ({
  tasksApi: {
    today: vi.fn(),
    complete: vi.fn().mockResolvedValue({}),
    incomplete: vi.fn().mockResolvedValue({}),
  },
}))

import { tasksApi } from '../api/tasks'
import { getLocalToday } from '../utils/date'
import TodayPage from '../pages/TodayPage'

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: 0, created_at: '', updated_at: '', subtask_count: 0,
    completed_subtask_count: 0, tags: [], focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false,
    item_title: null, item_type: null, ...extra,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <QueryClientProvider client={qc}><TodayPage /></QueryClientProvider>
    </MemoryRouter>
  )
}

describe('TodayPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for the client local date and shows each list with the parent item', async () => {
    vi.mocked(tasksApi.today).mockResolvedValue({
      overdue: [task(1, 'Late report', { due_date: '2026-10-20', item_title: 'Migrate CML' })],
      due_today: [task(2, 'Standup notes')],
      focused: [task(3, 'Review PR', { focus_date: '2026-10-28', item_title: 'Analytics' })],
      waiting: [task(4, 'Firewall rule', { waiting_for: 'Security team' })],
    })
    renderPage()
    expect(await screen.findByText('Late report')).toBeTruthy()
    expect(tasksApi.today).toHaveBeenCalledWith(getLocalToday())
    expect(screen.getByRole('heading', { name: /Overdue/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Due today/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Planned for today/ })).toBeTruthy()
    expect(screen.getByText('Migrate CML')).toBeTruthy()
    expect(screen.getAllByText('Inbox').length).toBeGreaterThan(0)
    expect(screen.getByText('Waiting · Security team')).toBeTruthy()
  })

  it('collapses the waiting list', async () => {
    const user = userEvent.setup()
    vi.mocked(tasksApi.today).mockResolvedValue({
      overdue: [], due_today: [], focused: [],
      waiting: [task(4, 'Firewall rule', { waiting_for: 'Security team' })],
    })
    renderPage()
    const toggle = await screen.findByRole('button', { name: /Waiting for/ })
    expect(screen.getByText('Firewall rule')).toBeTruthy()
    await user.click(toggle)
    expect(screen.queryByText('Firewall rule')).toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows an empty state when nothing is planned', async () => {
    vi.mocked(tasksApi.today).mockResolvedValue({ overdue: [], due_today: [], focused: [], waiting: [] })
    renderPage()
    expect(await screen.findByText('Nothing planned for today.')).toBeTruthy()
  })

  it('completes a task from Today', async () => {
    const user = userEvent.setup()
    vi.mocked(tasksApi.today).mockResolvedValue({
      overdue: [], due_today: [task(2, 'Standup notes')], focused: [], waiting: [],
    })
    renderPage()
    await user.click(await screen.findByRole('checkbox', { name: 'Mark complete: Standup notes' }))
    await waitFor(() => expect(tasksApi.complete).toHaveBeenCalledWith(2))
  })
})
