import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MeetingSummary } from '../types/models'

const useReviewMeetings = vi.fn()
vi.mock('../hooks/useReview', () => ({ useReviewMeetings: () => useReviewMeetings(), reviewKeys: { all: ['review'] } }))
vi.mock('../api/meetings', () => ({ meetingsApi: { closeActions: vi.fn() } }))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

import { meetingsApi } from '../api/meetings'

import { MeetingsStep } from '../components/review/MeetingsStep'

const render = (ui: React.ReactElement) =>
  rtlRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>)

function row(id: number, title: string, open_action_count: number): MeetingSummary {
  return {
    id, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false, title,
    held_at: '2026-10-28T03:00:00Z', attendees: '', processed_at: null, updated_at: '2026-10-28T03:00:00Z',
    open_action_count,
  }
}

describe('MeetingsStep', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists each meeting with its item, action count and a link that opens in a new tab', () => {
    useReviewMeetings.mockReturnValue({ data: [row(2, 'Weekly sync', 3), row(1, 'Kickoff', 1)], isLoading: false })
    render(<MeetingsStep />)
    expect(screen.getByRole('heading', { level: 1, name: 'Process your meetings' })).toBeTruthy()
    expect(screen.getByText('3 actions to process')).toBeTruthy()
    expect(screen.getByText('1 action to process')).toBeTruthy()
    expect(screen.getAllByText(/Migrate CML/)).toHaveLength(2)
    const link = screen.getByRole('link', { name: /Weekly sync in a new tab/ })
    expect(link.getAttribute('href')).toBe('/meetings/2')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('says so when there is nothing to process', () => {
    useReviewMeetings.mockReturnValue({ data: [], isLoading: false })
    render(<MeetingsStep />)
    expect(screen.getByText('Nothing to process')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows placeholders while loading', () => {
    useReviewMeetings.mockReturnValue({ data: undefined, isLoading: true })
    render(<MeetingsStep />)
    expect(screen.queryByText('Nothing to process')).toBeNull()
  })

  it('Nothing more closes the meeting and keeps its row, dimmed, with Process still there', async () => {
    const user = userEvent.setup()
    const meetings = [row(2, 'Weekly sync', 3), row(1, 'Kickoff', 1)]
    useReviewMeetings.mockReturnValue({ data: meetings, isLoading: false })
    vi.mocked(meetingsApi.closeActions).mockResolvedValue({ ...row(2, 'Weekly sync', 0), body: '', created_at: '' } as never)
    const view = render(<MeetingsStep />)

    await user.click(screen.getByRole('button', { name: 'Nothing more to process in Weekly sync' }))
    await waitFor(() => expect(meetingsApi.closeActions).toHaveBeenCalledWith(2))
    expect(await screen.findByText('No more actions')).toBeTruthy()

    // the server list no longer has it: the row stays
    useReviewMeetings.mockReturnValue({ data: [meetings[1]], isLoading: false })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}><MeetingsStep /></QueryClientProvider>
    )
    expect(screen.getByText('Weekly sync')).toBeTruthy()
    expect(screen.getByText('No more actions')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nothing more to process in Weekly sync' })).toBeNull()
    expect(screen.getByRole('link', { name: /Weekly sync in a new tab/ })).toBeTruthy()
    // the other meeting is untouched
    expect(screen.getByRole('button', { name: 'Nothing more to process in Kickoff' })).toBeTruthy()
  })

  it('shows the empty state only when no row is left', () => {
    useReviewMeetings.mockReturnValue({ data: [], isLoading: false })
    render(<MeetingsStep />)
    expect(screen.getByText('Nothing to process')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nothing more/ })).toBeNull()
  })
})
