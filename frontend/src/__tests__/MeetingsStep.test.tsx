import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MeetingSummary } from '../types/models'

const useReviewMeetings = vi.fn()
vi.mock('../hooks/useReview', () => ({ useReviewMeetings: () => useReviewMeetings() }))

import { MeetingsStep } from '../components/review/MeetingsStep'

function row(id: number, title: string, open_action_count: number): MeetingSummary {
  return {
    id, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false, title,
    held_at: '2026-10-28T03:00:00Z', attendees: '', processed_at: null, updated_at: '2026-10-28T03:00:00Z',
    open_action_count,
  }
}

describe('MeetingsStep', () => {
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
})
