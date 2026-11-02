import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from '../types/models'
import { plannedLabel } from '../utils/date'

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../components/tasks/TaskDrawer', () => ({ TaskDrawer: () => null }))
vi.mock('../api/calendar', () => ({ calendarApi: { week: vi.fn().mockResolvedValue({ days: [] }) } }))
vi.mock('../api/tasks', () => ({
  tasksApi: { today: vi.fn(), update: vi.fn(), complete: vi.fn(), incomplete: vi.fn() },
}))

import { tasksApi } from '../api/tasks'
import { notify } from '../lib/toast'
import { PlannedEarlier } from '../components/today/PlannedEarlier'
import TodayPage from '../pages/TodayPage'

const TODAY = '2026-10-29' // Thursday

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium', is_complete: false,
    sort_order: 0, created_at: '', updated_at: '', subtask_count: 0, completed_subtask_count: 0, tags: [],
    focus_date: null, waiting_for: null, waiting_since: null, completed_at: null, defer_until: null, is_someday: false,
    meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter><QueryClientProvider client={qc}>{ui}</QueryClientProvider></MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 12))
  vi.mocked(tasksApi.update).mockResolvedValue({} as Task)
})
afterEach(() => vi.useRealTimers())

describe('plannedLabel', () => {
  it('a weekday for the last six days, a date for anything older', () => {
    expect(plannedLabel('2026-10-28', TODAY)).toBe('Planned Wed')
    expect(plannedLabel('2026-10-23', TODAY)).toBe('Planned Fri')
    expect(plannedLabel('2026-10-22', TODAY)).toBe('Planned 22 Oct')
    expect(plannedLabel('2025-12-30', TODAY)).toBe('Planned 30 Dec 2025')
  })
})

describe('PlannedEarlier', () => {
  const plans = [
    task(3, 'Newest plan', { focus_date: '2026-10-28' }),
    task(1, 'Oldest plan', { focus_date: '2026-10-10' }),
    task(2, 'Middle plan', { focus_date: '2026-10-24' }),
  ]
  const setup = () => wrap(<PlannedEarlier tasks={plans} today={TODAY} selectedTaskId={null} onOpenDrawer={vi.fn()} onToggleComplete={vi.fn()} />)

  it('lists the old plans oldest first, each with when it was planned', () => {
    setup()
    const rows = within(screen.getByRole('list', { name: 'Planned earlier' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Oldest plan'), expect.stringContaining('Middle plan'), expect.stringContaining('Newest plan'),
    ])
    expect(rows[0].textContent).toContain('Planned 10 Oct')
    expect(rows[1].textContent).toContain('Planned Sat')
    expect(rows[2].textContent).toContain('Planned Wed')
    expect(screen.getByRole('heading', { name: /Planned earlier 3/ })).toBeTruthy()
  })

  it('renders nothing when there are no old plans', () => {
    wrap(<PlannedEarlier tasks={[]} today={TODAY} selectedTaskId={null} onOpenDrawer={vi.fn()} onToggleComplete={vi.fn()} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('"Keep for today" moves the plan to today and "Remove from Today" takes it off', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    setup()
    const rows = within(screen.getByRole('list', { name: 'Planned earlier' })).getAllByRole('listitem')
    await user.click(within(rows[0]).getByRole('button', { name: 'Keep for today' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(1, { focus_date: TODAY }))
    await user.click(within(rows[1]).getByRole('button', { name: 'Remove from Today' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(2, { focus_date: null }))
  })

  it('"Clear all" removes every plan with one Undo that puts each date back', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    setup()
    await user.click(screen.getByRole('button', { name: 'Clear all (3)' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledTimes(3))
    for (const id of [1, 2, 3]) expect(tasksApi.update).toHaveBeenCalledWith(id, { focus_date: null })
    const [message, options] = vi.mocked(notify.success).mock.calls[0] as unknown as [string, { action: { label: string; onClick: () => void } }]
    expect(message).toBe('Removed 3 tasks from Today')
    expect(options.action.label).toBe('Undo')
    vi.mocked(tasksApi.update).mockClear()
    options.action.onClick()
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledTimes(3))
    expect(tasksApi.update).toHaveBeenCalledWith(1, { focus_date: '2026-10-10' })
    expect(tasksApi.update).toHaveBeenCalledWith(2, { focus_date: '2026-10-24' })
    expect(tasksApi.update).toHaveBeenCalledWith(3, { focus_date: '2026-10-28' })
  })

  it('"Clear all" reports the ones that failed and only offers to undo the ones that worked', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    vi.mocked(tasksApi.update).mockImplementation(async (id) => {
      if (id === 2) throw new Error('nope')
      return {} as Task
    })
    setup()
    await user.click(screen.getByRole('button', { name: 'Clear all (3)' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('1 task could not be removed.'))
    expect(notify.success).toHaveBeenCalledWith('Removed 2 tasks from Today', expect.anything())
    const options = vi.mocked(notify.success).mock.calls[0][1] as unknown as { action: { onClick: () => void } }
    vi.mocked(tasksApi.update).mockClear()
    options.action.onClick()
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledTimes(2))
    expect(vi.mocked(tasksApi.update).mock.calls.map(([id]) => id).sort()).toEqual([1, 3])
  })
})

describe('Today page with old plans', () => {
  it('splits plans: today\'s stay "Planned for today", older ones go to "Planned earlier"', async () => {
    vi.mocked(tasksApi.today).mockResolvedValue({
      overdue: [], due_today: [], waiting: [],
      focused: [task(1, 'Planned now', { focus_date: TODAY }), task(2, 'Planned long ago', { focus_date: '2026-10-20' })],
    })
    wrap(<TodayPage />)
    expect(await screen.findByRole('heading', { name: /Planned for today 1/ })).toBeTruthy()
    const now = screen.getByRole('heading', { name: /Planned for today/ }).closest('section')!
    expect(now.textContent).toContain('Planned now')
    expect(now.textContent).not.toContain('Planned long ago')
    expect(screen.getByRole('heading', { name: /Planned earlier 1/ }).closest('section')!.textContent).toContain('Planned long ago')
  })

  it('shows only the old-plans block (and no empty message) when nothing else is planned', async () => {
    vi.mocked(tasksApi.today).mockResolvedValue({
      overdue: [], due_today: [], waiting: [], focused: [task(2, 'Planned long ago', { focus_date: '2026-10-20' })],
    })
    wrap(<TodayPage />)
    expect(await screen.findByRole('heading', { name: /Planned earlier 1/ })).toBeTruthy()
    expect(screen.queryByText('Nothing planned for today.')).toBeNull()
    expect(screen.queryByRole('heading', { name: /Planned for today/ })).toBeNull()
  })

  it('no old plans: no extra block', async () => {
    vi.mocked(tasksApi.today).mockResolvedValue({
      overdue: [], due_today: [], waiting: [], focused: [task(1, 'Planned now', { focus_date: TODAY })],
    })
    wrap(<TodayPage />)
    await screen.findByRole('heading', { name: /Planned for today/ })
    expect(screen.queryByRole('heading', { name: /Planned earlier/ })).toBeNull()
  })
})
