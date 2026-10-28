import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TemplateDetailPage from '../pages/TemplateDetailPage'
import type { TemplateDetail, TemplateTask } from '../types/models'

const mockTask1: TemplateTask = {
  id: 10,
  template_id: 1,
  title: 'Define requirements',
  description: '',
  priority: 'high',
  relative_days: 0,
  sort_order: 0,
}
const mockTask2: TemplateTask = {
  id: 11,
  template_id: 1,
  title: 'Write tests',
  description: 'Unit and integration tests',
  priority: 'medium',
  relative_days: 7,
  sort_order: 1,
}
const mockTask3: TemplateTask = {
  id: 12,
  template_id: 1,
  title: 'Deploy',
  description: '',
  priority: 'low',
  relative_days: 14,
  sort_order: 2,
}

const mockTemplate: TemplateDetail = {
  id: 1,
  title: 'Sprint Template',
  description: 'A sprint workflow',
  task_count: 3,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  tasks: [mockTask1, mockTask2, mockTask3],
}

const mockCreateTask = vi.fn().mockResolvedValue({ ...mockTask1, id: 99 })
const mockUpdateTask = vi.fn().mockResolvedValue({ ...mockTask1, title: 'Updated Task' })
const mockDeleteTask = vi.fn().mockResolvedValue({})
const mockUpdateTemplate = vi.fn().mockResolvedValue({ ...mockTemplate, title: 'New Title', tasks: mockTemplate.tasks })
const mockDeleteTemplate = vi.fn().mockResolvedValue({})
const mockReorder = vi.fn().mockResolvedValue([mockTask3, mockTask1, mockTask2])

vi.mock('../hooks/useTemplates', () => ({
  useTemplate: vi.fn(() => ({ data: mockTemplate, isLoading: false, isError: false })),
  useUpdateTemplate: vi.fn(() => ({ mutateAsync: mockUpdateTemplate, isPending: false })),
  useDeleteTemplate: vi.fn(() => ({ mutateAsync: mockDeleteTemplate, isPending: false })),
  useCreateTemplateTask: vi.fn(() => ({ mutateAsync: mockCreateTask, isPending: false })),
  useUpdateTemplateTask: vi.fn(() => ({ mutateAsync: mockUpdateTask, isPending: false })),
  useDeleteTemplateTask: vi.fn(() => ({ mutateAsync: mockDeleteTask, isPending: false })),
  useReorderTemplateTasks: vi.fn(() => ({ mutate: mockReorder, isPending: false })),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter initialEntries={['/templates/1']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/templates/:id" element={children} />
          <Route path="/templates" element={<div>Templates list</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('TemplateDetailPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders template title', () => {
    render(<TemplateDetailPage />, { wrapper })
    expect(screen.getByText('Sprint Template')).toBeTruthy()
  })

  it('shows all template tasks', () => {
    render(<TemplateDetailPage />, { wrapper })
    expect(screen.getByText('Define requirements')).toBeTruthy()
    expect(screen.getByText('Write tests')).toBeTruthy()
    expect(screen.getByText('Deploy')).toBeTruthy()
  })

  it('shows relative day offsets', () => {
    render(<TemplateDetailPage />, { wrapper })
    expect(screen.getByText('Day 0')).toBeTruthy()
    expect(screen.getByText('Day 7')).toBeTruthy()
    expect(screen.getByText('Day 14')).toBeTruthy()
  })

  it('has Add task button', () => {
    render(<TemplateDetailPage />, { wrapper })
    expect(screen.getByRole('button', { name: /add task/i })).toBeTruthy()
  })

  it('opens add task dialog', async () => {
    const user = userEvent.setup()
    render(<TemplateDetailPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(screen.getByText('Add task to template')).toBeTruthy()
  })

  it('add task dialog submits and calls createTask', async () => {
    const user = userEvent.setup()
    render(<TemplateDetailPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => screen.getByRole('dialog'))
    await user.type(screen.getByLabelText(/^title$/i), 'New Task')
    await user.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 1, payload: expect.objectContaining({ title: 'New Task' }) })
    ))
  })

  it('edit task via actions menu opens edit dialog', async () => {
    const user = userEvent.setup()
    render(<TemplateDetailPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /actions for define requirements/i }))
    await user.click(screen.getByRole('menuitem', { name: /^edit$/i }))
    await waitFor(() => expect(screen.getByText('Edit task')).toBeTruthy())
  })

  it('delete task via actions menu shows ConfirmDialog', async () => {
    const user = userEvent.setup()
    render(<TemplateDetailPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /actions for define requirements/i }))
    await user.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy())
    // Dialog has a heading "Delete task"
    expect(screen.getByRole('heading', { name: /delete task/i })).toBeTruthy()
  })

  it('confirm delete task calls deleteTask', async () => {
    const user = userEvent.setup()
    render(<TemplateDetailPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /actions for define requirements/i }))
    await user.click(screen.getByRole('menuitem', { name: /^delete$/i }))
    await waitFor(() => screen.getByRole('alertdialog'))
    await user.click(screen.getByRole('button', { name: /delete task/i }))
    await waitFor(() => expect(mockDeleteTask).toHaveBeenCalled())
  })

  it('delete template button shows ConfirmDialog', async () => {
    const user = userEvent.setup()
    render(<TemplateDetailPage />, { wrapper })
    await user.click(screen.getByRole('button', { name: /delete template/i }))
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy())
  })

  it('has drag handles for each task', () => {
    render(<TemplateDetailPage />, { wrapper })
    const handles = screen.getAllByRole('button', { name: /reorder/i })
    expect(handles.length).toBe(3)
  })

  it('drag handles have role=button and aria-label', () => {
    render(<TemplateDetailPage />, { wrapper })
    const handle = screen.getByRole('button', { name: /reorder define requirements/i })
    expect(handle).toBeTruthy()
    expect(handle.getAttribute('aria-label')).toBe('Reorder Define requirements')
  })

  it('task list has role=list', () => {
    render(<TemplateDetailPage />, { wrapper })
    expect(screen.getByRole('list', { name: /template tasks/i })).toBeTruthy()
  })

  it('each task row has role=listitem', () => {
    render(<TemplateDetailPage />, { wrapper })
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(3)
  })
})
