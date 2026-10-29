import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CalendarDay, CalendarWeek, MeetingSummary, Task } from '../types/models'

vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../components/tasks/TaskDrawer', () => ({ TaskDrawer: () => null }))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../api/tasks', () => ({
  tasksApi: {
    today: vi.fn(),
    update: vi.fn(),
    complete: vi.fn().mockResolvedValue({}),
    incomplete: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('../api/calendar', () => ({ calendarApi: { week: vi.fn() } }))

import { tasksApi } from '../api/tasks'
import { calendarApi } from '../api/calendar'
import { notify } from '../lib/toast'
import { useRescheduleTask, weekKeys } from '../hooks/useCalendar'
import TodayPage from '../pages/TodayPage'

const TODAY = '2026-10-29'  // Thursday
const MONDAY = '2026-10-26'

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: 0, created_at: '', updated_at: '', subtask_count: 0,
    completed_subtask_count: 0, tags: [], focus_date: null, waiting_for: null, waiting_since: null, defer_until: null,
    is_someday: false, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

function meeting(id: number, title: string): MeetingSummary {
  return {
    id, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false, title,
    held_at: '2026-10-29T03:00:00Z', attendees: '', processed_at: null, updated_at: '', open_action_count: 0,
  }
}

function weekOf(start: string, patch: Record<string, Partial<CalendarDay>> = {}): CalendarWeek {
  const base = new Date(`${start}T00:00:00`)
  return {
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { date, meetings: [], due: [], planned: [], deadlines: [], starts: [], ...patch[date] }
    }),
  }
}

function Probe() {
  const loc = useLocation()
  return <div data-testid="url">{loc.pathname + loc.search}</div>
}

function renderPage(url = '/today') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={qc}><TodayPage /><Probe /></QueryClientProvider>
    </MemoryRouter>
  )
}

const url = () => screen.getByTestId('url').textContent

describe('Today page week view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0))
    vi.mocked(tasksApi.today).mockResolvedValue({ overdue: [], due_today: [], focused: [], waiting: [] })
    vi.mocked(calendarApi.week).mockImplementation(async (start) => weekOf(start, {
      [TODAY]: { meetings: [meeting(1, 'Weekly sync')] },
      '2026-10-30': { due: [task(5, 'Send report')], deadlines: [{ id: 9, title: 'Ship it' }] },
    }))
  })
  afterEach(() => vi.useRealTimers())

  it('asks for the Monday of the current week with the local date and shows the range', async () => {
    renderPage()
    expect(await screen.findByRole('list', { name: 'Week' })).toBeTruthy()
    expect(calendarApi.week).toHaveBeenCalledWith(MONDAY, TODAY, expect.stringMatching(/^[+-]\d\d:\d\d$/))
    expect(screen.getByText('26 Oct – 1 Nov 2026')).toBeTruthy()
  })

  it('shows today\'s meetings above the usual Today sections', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /Meetings/ })).toBeTruthy()
    expect(screen.getAllByText(/Weekly sync/).length).toBeGreaterThan(1)  // in the strip and in the list
    expect(screen.getByText('Nothing planned for today.')).toBeTruthy()
  })

  it('moves between weeks through the URL and back with "This week"', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('list', { name: 'Week' })
    expect(screen.getByRole('button', { name: 'This week' }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(url()).toBe('/today?week=2026-11-02')
    await waitFor(() => expect(calendarApi.week).toHaveBeenCalledWith('2026-11-02', TODAY, expect.any(String)))
    expect(screen.getByText('2 Nov – 8 Nov 2026')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(url()).toBe('/today?week=2026-10-19')
    await user.click(screen.getByRole('button', { name: 'This week' }))
    expect(url()).toBe('/today')
  })

  it('opens the week from the URL, and ignores a broken week or day', async () => {
    renderPage('/today?week=2026-11-04')  // a Wednesday: the week of Monday 2 Nov
    await screen.findByRole('list', { name: 'Week' })
    expect(calendarApi.week).toHaveBeenCalledWith('2026-11-02', TODAY, expect.any(String))
  })

  it('a bad week parameter falls back to the current week', async () => {
    renderPage('/today?week=2026-13-45&day=nope')
    await screen.findByRole('list', { name: 'Week' })
    expect(calendarApi.week).toHaveBeenCalledWith(MONDAY, TODAY, expect.any(String))
    expect(screen.getByText('Nothing planned for today.')).toBeTruthy()
  })

  it('selecting another day lists its meetings, tasks and deadlines, and keeps the week in the URL', async () => {
    const user = userEvent.setup()
    renderPage('/today?week=2026-10-26')
    const strip = await screen.findByRole('list', { name: 'Week' })
    await user.click(strip.querySelector('[data-date="2026-10-30"] button[aria-pressed]') as HTMLElement)
    expect(url()).toBe('/today?week=2026-10-26&day=2026-10-30')
    const plan = await screen.findByRole('region', { name: /Plan for Fri 30 Oct/ })
    expect(plan.textContent).toContain('Send report')
    expect(plan.textContent).toContain('Ship it')
    expect(screen.queryByText('Nothing planned for today.')).toBeNull()
  })

  it('says so when the selected day is empty', async () => {
    const user = userEvent.setup()
    renderPage()
    const strip = await screen.findByRole('list', { name: 'Week' })
    await user.click(strip.querySelector('[data-date="2026-10-27"] button[aria-pressed]') as HTMLElement)
    expect(await screen.findByText('Nothing on this day.')).toBeTruthy()
  })

  it('opening a task keeps the week and day in the URL', async () => {
    const user = userEvent.setup()
    renderPage('/today?day=2026-10-30')
    await user.click((await screen.findAllByRole('button', { name: 'Send report' }))[0])
    expect(url()).toContain('task=5')
    expect(url()).toContain('day=2026-10-30')
  })
})

describe('useRescheduleTask', () => {
  const t = task(5, 'Send report', { due_date: '2026-10-30' })

  function setup() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const key = weekKeys.week(MONDAY, TODAY)
    qc.setQueryData<CalendarWeek>(key, weekOf(MONDAY, { '2026-10-30': { due: [t] } }))
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useRescheduleTask(), { wrapper })
    const dueOn = (date: string) => qc.getQueryData<CalendarWeek>(key)!.days.find((d) => d.date === date)!.due
    return { qc, result, dueOn }
  }

  beforeEach(() => vi.clearAllMocks())

  it('sets the due date, moves the task on screen and offers Undo that restores the old date', async () => {
    vi.mocked(tasksApi.update).mockResolvedValue(t)
    const { result, dueOn } = setup()
    await act(async () => { await result.current.mutateAsync({ task: t, toDate: '2026-10-31' }) })
    expect(tasksApi.update).toHaveBeenCalledWith(5, { due_date: '2026-10-31' })
    expect(notify.success).toHaveBeenCalledWith('Due date moved to Sat 31 Oct', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }))
    expect(dueOn('2026-10-30')).toEqual([])

    const options = vi.mocked(notify.success).mock.calls[0][1] as { action: { onClick: () => void } }
    options.action.onClick()
    await waitFor(() => expect(tasksApi.update).toHaveBeenLastCalledWith(5, { due_date: '2026-10-30' }))
  })

  it('puts the task back and shows the server message when the move is rejected', async () => {
    vi.mocked(tasksApi.update).mockRejectedValue(new Error('Due date cannot be before the defer date'))
    const { result, dueOn } = setup()
    await act(async () => { await result.current.mutateAsync({ task: t, toDate: '2026-10-31' }).catch(() => {}) })
    expect(dueOn('2026-10-30').map((x) => x.id)).toEqual([5])
    expect(dueOn('2026-10-31')).toEqual([])
    expect(notify.error).toHaveBeenCalledWith("Couldn't move the task.", 'Due date cannot be before the defer date')
  })
})
