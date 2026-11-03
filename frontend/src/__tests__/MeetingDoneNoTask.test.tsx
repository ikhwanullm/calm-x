import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meeting, MeetingActions } from '../types/models'

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../api/meetings', () => ({
  meetingsApi: {
    get: vi.fn(), update: vi.fn(), actions: vi.fn(), process: vi.fn(), closeLines: vi.fn(), delete: vi.fn(), restore: vi.fn(),
  },
}))

import { meetingsApi } from '../api/meetings'
import { notify } from '../lib/toast'
import MeetingPage from '../pages/MeetingPage'

const BODY = '- [ ] Send the report\n@Budi: send the logs\n'
const CLOSED_BODY = '- [x] Send the report\n@Budi: send the logs\n'

function meeting(extra: Partial<Meeting> = {}): Meeting {
  return {
    id: 7, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false,
    title: 'Kickoff', held_at: '2026-10-28T03:00:00Z', attendees: '', processed_at: null,
    updated_at: '2026-10-28T03:00:00Z', open_action_count: 2, body: BODY, created_at: '2026-10-28T03:00:00Z',
    ...extra,
  }
}

const OPEN: MeetingActions = {
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

describe('Done, no task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting())
    vi.mocked(meetingsApi.actions).mockResolvedValue(OPEN)
  })

  it('has a button next to every open action', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'Done, no task: Send the report' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done, no task: send the logs' })).toBeTruthy()
  })

  it('closes the line, shows the rewritten notes and says how many were done without a task', async () => {
    const user = userEvent.setup()
    vi.mocked(meetingsApi.closeLines).mockResolvedValue(meeting({ body: CLOSED_BODY, open_action_count: 1 }))
    renderPage()
    const button = await screen.findByRole('button', { name: 'Done, no task: Send the report' })
    // what the server lists once the line is closed (the list is refetched after the change)
    vi.mocked(meetingsApi.actions).mockResolvedValue({ ...OPEN, actions: [OPEN.actions[1]], closed: 1 })
    await user.click(button)

    await waitFor(() => expect(meetingsApi.closeLines).toHaveBeenCalledWith(7, [{ line: 0, text: 'Send the report' }]))
    await waitFor(() => expect((screen.getByLabelText('Meeting notes') as HTMLTextAreaElement).value).toBe(CLOSED_BODY))

    expect(await screen.findByText('1 done without a task')).toBeTruthy()
    expect(meetingsApi.process).not.toHaveBeenCalled()
  })

  it('tells the owner when the notes changed since the list was shown', async () => {
    const user = userEvent.setup()
    vi.mocked(meetingsApi.closeLines).mockRejectedValue(new Error('409'))
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Done, no task: Send the report' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect((screen.getByLabelText('Meeting notes') as HTMLTextAreaElement).value).toBe(BODY)
  })

  it('is not offered for a meeting of an archived item', async () => {
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting({ item_archived: true }))
    renderPage()
    await screen.findByLabelText('Meeting title')
    expect(screen.queryByRole('button', { name: /^Done, no task/ })).toBeNull()
  })
})
