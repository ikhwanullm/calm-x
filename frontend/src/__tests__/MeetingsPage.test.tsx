import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MeetingSummary } from '../types/models'

vi.mock('../api/meetings', () => ({ meetingsApi: { list: vi.fn() } }))

import { meetingsApi } from '../api/meetings'
import MeetingsPage from '../pages/MeetingsPage'

function row(id: number, title: string, held_at: string, extra: Partial<MeetingSummary> = {}): MeetingSummary {
  return {
    id, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false, title, held_at,
    attendees: '', processed_at: null, updated_at: held_at, open_action_count: 0, ...extra,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}><MeetingsPage /></QueryClientProvider>
    </MemoryRouter>
  )
}

describe('MeetingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('groups meetings by week with the item, time and actions left', async () => {
    vi.mocked(meetingsApi.list).mockResolvedValue([
      row(3, 'Thursday sync', '2026-10-29T08:00:00', { open_action_count: 2 }),
      row(2, 'Tuesday review', '2026-10-27T08:00:00', { item_title: 'Ops', item_archived: true }),
      row(1, 'Old kickoff', '2026-10-14T08:00:00'),
    ])
    renderPage()
    const thisWeek = await screen.findByRole('region', { name: 'Week of 26 Oct 2026' })
    expect(within(thisWeek).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Thursday sync'),
      expect.stringContaining('Tuesday review'),
    ])
    expect(within(thisWeek).getByText('2 actions to process')).toBeTruthy()
    expect(within(thisWeek).getByText(/Ops · .*· archived/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Week of 12 Oct 2026' })).toBeTruthy()
    expect(within(thisWeek).getByRole('link', { name: /Thursday sync/ }).getAttribute('href')).toBe('/meetings/3')
  })

  it('searches after a short pause', async () => {
    vi.mocked(meetingsApi.list).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(meetingsApi.list).toHaveBeenCalledWith(undefined))
    fireEvent.change(screen.getByLabelText('Search meetings'), { target: { value: 'firewall' } })
    await waitFor(() => expect(meetingsApi.list).toHaveBeenLastCalledWith('firewall'))
    expect(await screen.findByText('No meetings match your search.')).toBeTruthy()
  })

  it('shows how to start when there are no meetings at all', async () => {
    vi.mocked(meetingsApi.list).mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No meetings yet.')).toBeTruthy()
  })

  it('shows an error when loading fails', async () => {
    vi.mocked(meetingsApi.list).mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText(/Couldn.t load meetings/)).toBeTruthy()
  })
})
