import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TemplatesPage from '../pages/TemplatesPage'
import type { Template } from '../types/models'

const mockTemplate1: Template = {
  id: 1,
  title: 'Sprint Kickoff',
  description: 'Standard sprint setup',
  task_count: 3,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}
const mockTemplate2: Template = {
  id: 2,
  title: 'Onboarding',
  description: 'New hire onboarding',
  task_count: 5,
  created_at: '2026-10-02T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
}

const mockCreate = vi.fn().mockResolvedValue({ ...mockTemplate1, id: 99, tasks: [] })
const mockUpdate = vi.fn().mockResolvedValue({ ...mockTemplate1, title: 'Updated', tasks: [] })
const mockDelete = vi.fn().mockResolvedValue({})

vi.mock('../hooks/useTemplates', () => ({
  useTemplates: vi.fn(() => ({ data: [mockTemplate1, mockTemplate2], isLoading: false, isError: false })),
  useCreateTemplate: vi.fn(() => ({ mutateAsync: mockCreate, isPending: false })),
  useUpdateTemplate: vi.fn(() => ({ mutateAsync: mockUpdate, isPending: false })),
  useDeleteTemplate: vi.fn(() => ({ mutateAsync: mockDelete, isPending: false })),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('TemplatesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders Templates heading', () => {
    render(<TemplatesPage />, { wrapper })
    expect(screen.getByRole('heading', { name: /templates/i })).toBeTruthy()
  })

  it('shows list of templates', () => {
    render(<TemplatesPage />, { wrapper })
    expect(screen.getByText('Sprint Kickoff')).toBeTruthy()
    expect(screen.getByText('Onboarding')).toBeTruthy()
  })

  it('shows task counts', () => {
    render(<TemplatesPage />, { wrapper })
    expect(screen.getByText('3 tasks')).toBeTruthy()
    expect(screen.getByText('5 tasks')).toBeTruthy()
  })

  it('has "New template" button', () => {
    render(<TemplatesPage />, { wrapper })
    expect(screen.getByRole('button', { name: /new template/i })).toBeTruthy()
  })

  it('opens create dialog on "New template" click', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /new template/i }))
    // Dialog appears (in addition to the button)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('create dialog calls createMutation on submit', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /new template/i }))
    await user.type(screen.getByLabelText(/title/i), 'My Template')
    await user.click(screen.getByRole('button', { name: /create template/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My Template' })
    ))
  })

  it('shows edit dialog via actions menu', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />, { wrapper })
    // Open the dropdown for first template
    await user.click(screen.getByRole('button', { name: /actions for sprint kickoff/i }))
    await user.click(screen.getByRole('menuitem', { name: /^edit$/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByText('Edit template')).toBeTruthy()
    })
  })

  it('delete via actions menu shows ConfirmDialog', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /actions for sprint kickoff/i }))
    await user.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeTruthy()
      expect(screen.getByRole('heading', { name: /delete template/i })).toBeTruthy()
    })
  })

  it('confirm delete calls deleteMutation', async () => {
    const user = userEvent.setup()
    render(<TemplatesPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /actions for sprint kickoff/i }))
    await user.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    await waitFor(() => screen.getByRole('alertdialog'))
    await user.click(screen.getByRole('button', { name: /delete template/i }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(1))
  })

  it('shows empty state when no templates', async () => {
    const { useTemplates } = vi.mocked(await import('../hooks/useTemplates'))
    useTemplates.mockReturnValueOnce({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTemplates>)
    render(<TemplatesPage />, { wrapper })
    expect(screen.getByText(/no templates yet/i)).toBeTruthy()
  })
})
