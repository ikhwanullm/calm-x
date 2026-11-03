import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meeting, MeetingActions } from '../types/models'

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../api/meetings', () => ({
  meetingsApi: {
    get: vi.fn(), update: vi.fn(), actions: vi.fn(), process: vi.fn(), closeLines: vi.fn(),
    closeActions: vi.fn(), reopenActions: vi.fn(), delete: vi.fn(), restore: vi.fn(),
  },
}))

import { meetingsApi } from '../api/meetings'
import MeetingPage from '../pages/MeetingPage'

const BODY = '- [ ] Send the report\n@Budi: send the logs\n'

function meeting(extra: Partial<Meeting> = {}): Meeting {
  return {
    id: 7, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false,
    title: 'Kickoff', held_at: '2026-10-28T03:00:00Z', attendees: '', processed_at: null, actions_closed_at: null,
    updated_at: '2026-10-28T03:00:00Z', open_action_count: 2, body: BODY, created_at: '2026-10-28T03:00:00Z',
    ...extra,
  }
}

const ACTIONS: MeetingActions = {
  actions: [
    { line: 0, kind: 'mine', text: 'Send the report', who: null },
    { line: 1, kind: 'waiting', text: 'send the logs', who: 'Budi' },
  ],
  questions: [], decisions: [], converted: 0, closed: 0,
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/meetings/7']}>
      <QueryClientProvider client={qc}>
        <Routes><Route path="/meetings/:id" element={<MeetingPage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Nothing more to process', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting())
    vi.mocked(meetingsApi.actions).mockResolvedValue(ACTIONS)
  })

  it('closes the actions of the meeting and then offers Reopen', async () => {
    const user = userEvent.setup()
    const closed = meeting({ actions_closed_at: new Date().toISOString(), open_action_count: 0 })
    vi.mocked(meetingsApi.closeActions).mockResolvedValue(closed)
    renderPage()
    const button = await screen.findByRole('button', { name: 'Nothing more to process' })
    vi.mocked(meetingsApi.get).mockResolvedValue(closed)  // what the server says after the change (it is refetched)
    await user.click(button)
    await waitFor(() => expect(meetingsApi.closeActions).toHaveBeenCalledWith(7))

    expect(await screen.findByText(/Actions closed today/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nothing more to process' })).toBeNull()
    // the lines are still listed, as "not turned into tasks", and can still be processed
    expect(screen.getByText('Not turned into tasks:')).toBeTruthy()
    expect(screen.getByText('Send the report')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Process actions' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('reopens a closed meeting', async () => {
    const user = userEvent.setup()
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting({ actions_closed_at: new Date().toISOString(), open_action_count: 0 }))
    vi.mocked(meetingsApi.reopenActions).mockResolvedValue(meeting())
    renderPage()
    const button = await screen.findByRole('button', { name: 'Reopen' })
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting())
    await user.click(button)
    await waitFor(() => expect(meetingsApi.reopenActions).toHaveBeenCalledWith(7))
    expect(await screen.findByRole('button', { name: 'Nothing more to process' })).toBeTruthy()
  })

  it('is not offered when there are no open actions or the item is archived', async () => {
    vi.mocked(meetingsApi.actions).mockResolvedValue({ ...ACTIONS, actions: [] })
    const first = renderPage()
    await screen.findByLabelText('Meeting title')
    expect(screen.queryByRole('button', { name: 'Nothing more to process' })).toBeNull()
    first.unmount()

    vi.mocked(meetingsApi.actions).mockResolvedValue(ACTIONS)
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting({ item_archived: true }))
    renderPage()
    await screen.findByLabelText('Meeting title')
    expect(screen.queryByRole('button', { name: 'Nothing more to process' })).toBeNull()
  })
})
