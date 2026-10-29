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
    someday: vi.fn(),
    complete: vi.fn().mockResolvedValue({}),
    incomplete: vi.fn().mockResolvedValue({}),
  },
}))

import { tasksApi } from '../api/tasks'
import SomedayPage from '../pages/SomedayPage'

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium',
    is_complete: false, sort_order: 0, created_at: '', updated_at: '', subtask_count: 0,
    completed_subtask_count: 0, tags: [], focus_date: null, waiting_for: null, waiting_since: null,
    defer_until: null, is_someday: true, meeting_id: null, meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/someday']}>
      <QueryClientProvider client={qc}><SomedayPage /></QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SomedayPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists parked tasks with their parent item', async () => {
    vi.mocked(tasksApi.someday).mockResolvedValue([
      task(1, 'Learn Rust'),
      task(2, 'Redo the wiki', { item_title: 'Docs' }),
    ])
    renderPage()
    expect(await screen.findByText('Learn Rust')).toBeTruthy()
    expect(screen.getByText('Redo the wiki')).toBeTruthy()
    expect(screen.getByText('Docs')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('2')
  })

  it('shows an empty state when nothing is parked', async () => {
    vi.mocked(tasksApi.someday).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Nothing parked.')).toBeTruthy()
  })

  it('shows an error message when loading fails', async () => {
    vi.mocked(tasksApi.someday).mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText(/Couldn.t load Someday/)).toBeTruthy()
  })

  it('completes a parked task', async () => {
    const user = userEvent.setup()
    vi.mocked(tasksApi.someday).mockResolvedValue([task(1, 'Learn Rust')])
    renderPage()
    await user.click(await screen.findByRole('checkbox', { name: 'Mark complete: Learn Rust' }))
    await waitFor(() => expect(tasksApi.complete).toHaveBeenCalledWith(1))
  })
})
