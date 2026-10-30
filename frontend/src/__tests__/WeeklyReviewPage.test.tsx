import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import WeeklyReviewPage from '../pages/WeeklyReviewPage'
import type { ReviewStatus, ReviewTaskItem, ReviewProjectItem, ReviewAreaItem, ReviewResourceItem } from '../api/review'

const mockStatus: ReviewStatus = { last_review_date: null, last_review_days_ago: null }
const mockInboxTasks: ReviewTaskItem[] = [
  { id: 1, title: 'Inbox task 1', description: '', priority: 'medium', created_at: '2026-10-20T10:00:00Z' },
  { id: 2, title: 'Inbox task 2', description: '', priority: 'high', created_at: '2026-10-19T10:00:00Z' },
]
const mockProjects: ReviewProjectItem[] = [
  {
    id: 10, title: 'Sprint 1', description: 'Sprint one',
    task_count: 5, open_task_count: 3, completed_task_count: 2,
    progress_percentage: 40, project_deadline: null, project_status: 'active',
    days_since_update: 5, is_stale: false, updated_at: '2026-10-23T10:00:00Z',
  },
]
const mockAreas: ReviewAreaItem[] = [
  {
    id: 20, title: 'Work', description: '', open_task_count: 4,
    next_task_title: 'Code review', days_since_update: 3, is_stale: false,
  },
]
const mockResources: ReviewResourceItem[] = [
  {
    id: 30, title: 'React Docs', description: '',
    days_since_update: 45, is_stale: true, updated_at: '2026-09-13T10:00:00Z',
  },
]
const mockCompleteReview = vi.fn().mockResolvedValue({ id: 1, completed_at: '2026-10-28T10:00:00Z', notes: '' })

vi.mock('../hooks/useReview', () => ({
  useReviewStatus: () => ({ data: mockStatus }),
  useReviewInbox: () => ({ data: mockInboxTasks, isLoading: false }),
  useReviewMeetings: () => ({ data: [], isLoading: false }),
  useReviewWaiting: () => ({ data: [], isLoading: false }),
  useReviewProjects: () => ({ data: mockProjects, isLoading: false }),
  useReviewAreas: () => ({ data: mockAreas, isLoading: false }),
  useReviewResources: () => ({ data: mockResources, isLoading: false }),
  useCompleteReview: () => ({ mutateAsync: mockCompleteReview, isPending: false }),
  reviewKeys: {
    all: ['weekly-review'],
    status: (t: string) => ['weekly-review', 'status', t],
    inbox: () => ['weekly-review', 'inbox'],
    meetings: (t: string) => ['weekly-review', 'meetings', t],
    waiting: (t: string) => ['weekly-review', 'waiting', t],
    projects: (t: string) => ['weekly-review', 'projects', t],
    areas: (t: string) => ['weekly-review', 'areas', t],
    resources: (t: string) => ['weekly-review', 'resources', t],
  },
}))

vi.mock('../hooks/useItems', () => ({
  useItems: () => ({ data: [], isLoading: false }),
  itemKeys: { all: ['items'], list: () => ['items', 'list'], detail: (id: number) => ['items', 'detail', id] },
}))

vi.mock('../hooks/useTasks', () => ({
  useMoveTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useCompleteTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useDeleteTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useItemTasks: () => ({ data: [], isLoading: false }),
  useCreateTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useFollowUpTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  usePatchTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useSomedayTasks: () => ({ data: [], isLoading: false }),
  taskKeys: { all: ['tasks'], inbox: () => ['tasks', 'inbox'], forItem: (id: number) => ['tasks', 'item', id] },
}))

vi.mock('../hooks/useItems', async () => ({
  useItems: () => ({ data: [], isLoading: false }),
  useCompleteProject: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useArchiveItem: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  itemKeys: { all: ['items'], list: () => ['items', 'list'], detail: (id: number) => ['items', 'detail', id] },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('WeeklyReviewPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the review header', () => {
    render(<WeeklyReviewPage />, { wrapper })
    expect(screen.getByText('Weekly review')).toBeTruthy()
    expect(screen.getByText(/Changes save as you go/i)).toBeTruthy()
  })

  it('shows 8-step nav', () => {
    render(<WeeklyReviewPage />, { wrapper })
    expect(screen.getByText('Inbox')).toBeTruthy()
    expect(screen.getByText('Meetings')).toBeTruthy()
    expect(screen.getByText('Waiting for')).toBeTruthy()
    expect(within(screen.getByRole('navigation', { name: 'Review steps' })).getByText('Someday')).toBeTruthy()
    expect(screen.getByText('Projects')).toBeTruthy()
    expect(screen.getByText('Areas')).toBeTruthy()
    expect(screen.getByText('Resources')).toBeTruthy()
    expect(screen.getByText('Summary')).toBeTruthy()
  })

  it('starts on Inbox step', () => {
    render(<WeeklyReviewPage />, { wrapper })
    expect(screen.getByText('Process your Inbox')).toBeTruthy()
    expect(screen.getByText('Inbox task 1')).toBeTruthy()
  })

  it('has Exit review button', () => {
    render(<WeeklyReviewPage />, { wrapper })
    expect(screen.getByRole('button', { name: /exit review/i })).toBeTruthy()
  })

  it('Back button is disabled on first step', () => {
    render(<WeeklyReviewPage />, { wrapper })
    const backBtn = screen.getByRole('button', { name: /back/i })
    expect(backBtn).toHaveProperty('disabled', true)
  })

  it('Next button navigates to Projects step', async () => {
    const user = userEvent.setup()
    render(<WeeklyReviewPage />, { wrapper })
    // Footer has a button with text "Meetings →", then "Projects →"
    for (const next of ['Meetings', 'Waiting for', 'Projects']) {
      const btns = screen.getAllByRole('button')
      const nextBtn = btns.find(b => b.textContent?.includes(next) && /→/.test(b.textContent ?? ''))
      expect(nextBtn).toBeTruthy()
      await user.click(nextBtn!)
    }
    await waitFor(() => expect(screen.getByText('Review active projects')).toBeTruthy())
  })

  it('navigates through all 8 steps to Summary', async () => {
    const user = userEvent.setup()
    render(<WeeklyReviewPage />, { wrapper })
    // Navigate through each step by clicking the footer Next button
    const stepNames = ['Meetings', 'Waiting for', 'Projects', 'Areas', 'Resources', 'Someday', 'Summary']
    for (const stepName of stepNames) {
      const btns = screen.getAllByRole('button')
      const nextBtn = btns.find(b =>
        b.textContent?.includes(stepName) && b.textContent?.includes('→')
      )
      if (nextBtn) await user.click(nextBtn)
    }
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { level: 1 })
      const summaryHeading = headings.find(h => h.textContent === 'Summary')
      expect(summaryHeading).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /complete review/i })).toBeTruthy()
  })

  it('complete review button calls mutation', async () => {
    const user = userEvent.setup()
    render(<WeeklyReviewPage />, { wrapper })
    // Navigate to Summary by clicking through all steps
    const nextSteps = ['Meetings', 'Waiting for', 'Projects', 'Areas', 'Resources', 'Someday', 'Summary']
    for (const step of nextSteps) {
      const btns = screen.getAllByRole('button')
      const nextBtn = btns.find(b => b.textContent?.includes(step) && b.textContent?.includes('→'))
      if (nextBtn) await user.click(nextBtn)
    }
    await waitFor(() => screen.getByRole('button', { name: /complete review/i }))
    await user.click(screen.getByRole('button', { name: /complete review/i }))
    await waitFor(() => expect(mockCompleteReview).toHaveBeenCalledWith(''))
  })
})
