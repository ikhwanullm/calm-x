import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StaleWaiting } from '../types/dashboard'
import type { Task } from '../types/models'

const state = vi.hoisted(() => ({
  waits: [] as unknown[],
  waitsLoading: false,
  someday: [] as unknown[],
  somedayLoading: false,
  followUp: vi.fn(),
  complete: vi.fn(),
  patch: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../hooks/useReview', () => ({
  useReviewWaiting: () => ({ data: state.waits, isLoading: state.waitsLoading }),
}))
vi.mock('../hooks/useTasks', () => ({
  useFollowUpTask: () => ({ mutateAsync: state.followUp }),
  useCompleteTask: () => ({ mutateAsync: state.complete }),
  usePatchTask: () => ({ mutateAsync: state.patch }),
  useDeleteTask: () => ({ mutateAsync: state.deleteTask }),
  useSomedayTasks: () => ({ data: state.someday, isLoading: state.somedayLoading }),
}))

import { WaitingStep } from '../components/review/WaitingStep'
import { SomedayStep } from '../components/review/SomedayStep'

function wait(id: number, title: string, extra: Partial<StaleWaiting> = {}): StaleWaiting {
  return {
    id, title, waiting_for: 'Budi', waiting_days: 9, due_date: null, item_id: 3, item_title: 'Migrate CML',
    item_type: 'project', ...extra,
  }
}

function parked(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: 3, title, description: '', notes: '', due_date: null, priority: 'medium', is_complete: false,
    sort_order: 0, created_at: '2026-10-01T10:00:00Z', updated_at: '', subtask_count: 0, completed_subtask_count: 0,
    tags: [], focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: true,
    meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: 'Migrate CML', item_type: 'project', ...extra,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 12))
  state.waits = []
  state.someday = []
  state.waitsLoading = false
  state.somedayLoading = false
  state.followUp.mockResolvedValue({})
  state.complete.mockResolvedValue({})
  state.patch.mockResolvedValue({})
  state.deleteTask.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('WaitingStep', () => {
  it('lists each wait with who, where and how long, longest first as the server sent them', () => {
    state.waits = [wait(1, 'UAT sign-off', { waiting_days: 12, due_date: '2026-10-31' }), wait(2, 'Loose end', { item_id: null, item_title: null, item_type: null, waiting_days: 1 })]
    render(<WaitingStep onHandled={vi.fn()} />)
    const rows = within(screen.getByRole('list', { name: 'Tasks you are waiting on' })).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('UAT sign-off')
    expect(rows[0].textContent).toContain('Migrate CML · waiting for Budi · due in 2 days')
    expect(rows[0].textContent).toContain('12 days')
    expect(rows[1].textContent).toContain('Inbox · waiting for Budi')
    expect(rows[1].textContent).toContain('1 day')
    expect(screen.getByText('2 of 2 still to check')).toBeTruthy()
  })

  it('"Followed up" records it, shows the outcome and counts it', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onHandled = vi.fn()
    state.waits = [wait(1, 'UAT sign-off')]
    render(<WaitingStep onHandled={onHandled} />)
    await user.click(screen.getByRole('button', { name: 'Followed up' }))
    expect(state.followUp).toHaveBeenCalledWith(1)
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Followed up today')
    expect(screen.queryByRole('button', { name: 'Followed up' })).toBeNull()
    expect(onHandled).toHaveBeenCalledTimes(1)
    expect(screen.getByText('All handled.')).toBeTruthy()
  })

  it('"Received, done" completes the task', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    state.waits = [wait(4, 'Report')]
    render(<WaitingStep onHandled={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Received, done' }))
    expect(state.complete).toHaveBeenCalledWith(4)
    expect((await screen.findByRole('status')).textContent).toContain('Marked done')
  })

  it('"Not waiting anymore" clears who it waits on', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    state.waits = [wait(5, 'Reply')]
    render(<WaitingStep onHandled={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Not waiting anymore' }))
    expect(state.patch).toHaveBeenCalledWith({ id: 5, payload: { waiting_for: null } })
    expect((await screen.findByRole('status')).textContent).toContain('normal task')
  })

  it('a failed action keeps the buttons and does not count', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onHandled = vi.fn()
    state.followUp.mockRejectedValue(new Error('offline'))
    state.waits = [wait(1, 'UAT sign-off')]
    render(<WaitingStep onHandled={onHandled} />)
    await user.click(screen.getByRole('button', { name: 'Followed up' }))
    expect(screen.getByRole('button', { name: 'Followed up' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(onHandled).not.toHaveBeenCalled()
  })

  it('says so when nothing waits on anyone', () => {
    render(<WaitingStep onHandled={vi.fn()} />)
    expect(screen.getByText('Nothing is waiting on anyone')).toBeTruthy()
  })
})

describe('SomedayStep', () => {
  it('lists parked ideas oldest first with where they live and how long they have been parked', () => {
    state.someday = [parked(2, 'Newer', { created_at: '2026-10-25T10:00:00Z' }), parked(1, 'Oldest', { item_id: null, item_title: null })]
    render(<SomedayStep onActivated={vi.fn()} onDropped={vi.fn()} />)
    const rows = within(screen.getByRole('list', { name: 'Someday ideas' })).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Oldest')
    expect(rows[0].textContent).toContain('Inbox · parked 28 days ago')
    expect(rows[1].textContent).toContain('Migrate CML · parked 4 days ago')
    expect(screen.getByText('2 of 2 still to decide')).toBeTruthy()
  })

  it('"Start it" takes the task off Someday and counts it', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onActivated = vi.fn()
    state.someday = [parked(7, 'Idea')]
    render(<SomedayStep onActivated={onActivated} onDropped={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Start it' }))
    expect(state.patch).toHaveBeenCalledWith({ id: 7, payload: { is_someday: false } })
    expect((await screen.findByRole('status')).textContent).toContain('Back in play')
    expect(onActivated).toHaveBeenCalledTimes(1)
  })

  it('"Drop" deletes the task and counts it', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    const onDropped = vi.fn()
    state.someday = [parked(8, 'Idea')]
    render(<SomedayStep onActivated={vi.fn()} onDropped={onDropped} />)
    await user.click(screen.getByRole('button', { name: 'Drop' }))
    expect(state.deleteTask).toHaveBeenCalledWith(8)
    expect((await screen.findByRole('status')).textContent).toContain('undo')
    expect(onDropped).toHaveBeenCalledTimes(1)
  })

  it('"Keep parked" changes nothing on the server', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    state.someday = [parked(9, 'Idea')]
    render(<SomedayStep onActivated={vi.fn()} onDropped={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Keep parked' }))
    expect(state.patch).not.toHaveBeenCalled()
    expect(state.deleteTask).not.toHaveBeenCalled()
    expect((await screen.findByRole('status')).textContent).toContain('Stays parked')
  })

  it('a handled idea stays on screen even after the server list changes', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} })
    state.someday = [parked(7, 'Idea')]
    const { rerender } = render(<SomedayStep onActivated={vi.fn()} onDropped={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Start it' }))
    state.someday = []   // the refetch no longer lists it
    rerender(<SomedayStep onActivated={vi.fn()} onDropped={vi.fn()} />)
    expect(screen.getByText('Idea')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Back in play')
  })

  it('says so when nothing is parked', () => {
    render(<SomedayStep onActivated={vi.fn()} onDropped={vi.fn()} />)
    expect(screen.getByText('No parked ideas')).toBeTruthy()
  })
})
