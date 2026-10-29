import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meeting, MeetingSummary } from '../types/models'

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../api/meetings', () => ({
  meetingsApi: { listForItem: vi.fn(), create: vi.fn() },
}))

import { meetingsApi } from '../api/meetings'
import { MeetingsSection } from '../components/meetings/MeetingsSection'
import { MEETING_TEMPLATE } from '../utils/meeting'

function row(id: number, title: string, extra: Partial<MeetingSummary> = {}): MeetingSummary {
  return {
    id, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false, title,
    held_at: '2026-10-28T03:00:00Z', attendees: '', processed_at: null, updated_at: '2026-10-28T03:00:00Z',
    open_action_count: 0, ...extra,
  }
}

function renderSection(isArchived = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/projects/3']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/projects/:id" element={<MeetingsSection itemId={3} itemTitle="Migrate CML" isArchived={isArchived} />} />
          <Route path="/meetings/:id" element={<div>Meeting page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('MeetingsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists meetings with a link each and how many actions are left to process', async () => {
    vi.mocked(meetingsApi.listForItem).mockResolvedValue([
      row(2, 'Weekly sync', { open_action_count: 3 }),
      row(1, 'Kickoff', { open_action_count: 1 }),
      row(0, 'Retro'),
    ])
    renderSection()
    const link = await screen.findByRole('link', { name: /Weekly sync/ })
    expect(link.getAttribute('href')).toBe('/meetings/2')
    expect(screen.getByText('3 actions to process')).toBeTruthy()
    expect(screen.getByText('1 action to process')).toBeTruthy()
    expect(screen.getAllByText(/to process/)).toHaveLength(2)
    expect(meetingsApi.listForItem).toHaveBeenCalledWith(3)
  })

  it('shows an empty hint', async () => {
    vi.mocked(meetingsApi.listForItem).mockResolvedValue([])
    renderSection()
    expect(await screen.findByText(/No meetings yet/)).toBeTruthy()
  })

  it('+ Meeting creates one with the item title, the current time and the template, then opens it', async () => {
    const user = userEvent.setup()
    vi.mocked(meetingsApi.listForItem).mockResolvedValue([])
    vi.mocked(meetingsApi.create).mockResolvedValue({ ...row(9, 'Migrate CML meeting'), body: MEETING_TEMPLATE, created_at: '' } as Meeting)
    renderSection()
    const before = Date.now()
    await user.click(await screen.findByRole('button', { name: /Meeting/ }))
    await waitFor(() => expect(meetingsApi.create).toHaveBeenCalled())
    const [itemId, payload] = vi.mocked(meetingsApi.create).mock.calls[0]
    expect(itemId).toBe(3)
    expect(payload.title).toBe('Migrate CML meeting')
    expect(payload.body).toBe(MEETING_TEMPLATE)
    expect(new Date(payload.held_at).getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(await screen.findByText('Meeting page')).toBeTruthy()
  })

  it('has no + Meeting for an archived item, but still lists its meetings', async () => {
    vi.mocked(meetingsApi.listForItem).mockResolvedValue([row(1, 'Kickoff')])
    renderSection(true)
    expect(await screen.findByRole('link', { name: /Kickoff/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Meeting/ })).toBeNull()
  })
})
