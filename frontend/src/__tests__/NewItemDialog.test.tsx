import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NewItemDialog } from '../components/items/NewItemDialog'

const mockCreateItem = vi.fn().mockResolvedValue({ id: 42 })
const mockCreateFromTemplate = vi.fn().mockResolvedValue({ id: 77 })

vi.mock('../hooks/useItems', () => ({
  useCreateItem: () => ({
    mutateAsync: mockCreateItem,
    isPending: false,
  }),
}))

const mockTemplateList = [
  { id: 1, title: 'Sprint Kickoff', description: '', task_count: 3, created_at: '', updated_at: '' },
]
const mockTemplateDetail = {
  id: 1,
  title: 'Sprint Kickoff',
  description: 'Sprint desc',
  task_count: 3,
  created_at: '',
  updated_at: '',
  tasks: [
    { id: 10, template_id: 1, title: 'Task A', description: '', priority: 'high', relative_days: 0, sort_order: 0 },
    { id: 11, template_id: 1, title: 'Task B', description: '', priority: 'medium', relative_days: 7, sort_order: 1 },
  ],
}

vi.mock('../hooks/useTemplates', () => ({
  useTemplates: () => ({ data: mockTemplateList }),
  useTemplate: (id: number) => ({
    data: id > 0 ? mockTemplateDetail : undefined,
  }),
  useCreateProjectFromTemplate: () => ({
    mutateAsync: mockCreateFromTemplate,
    isPending: false,
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

function renderDialog(props = {}) {
  return render(
    <NewItemDialog open={true} onOpenChange={() => {}} {...props} />,
    { wrapper }
  )
}

describe('NewItemDialog', () => {
  it('renders the dialog when open', () => {
    renderDialog()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('has type radio buttons', () => {
    renderDialog()
    expect(screen.getByRole('radio', { name: /project/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /area/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /resource/i })).toBeTruthy()
  })

  it('has title input with label', () => {
    renderDialog()
    expect(screen.getByLabelText(/title/i)).toBeTruthy()
  })

  it('shows inline error for empty title on submit', async () => {
    const user = userEvent.setup()
    renderDialog()
    const submitBtn = screen.getByRole('button', { name: /create project/i })
    await user.click(submitBtn)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Title is required')).toBeTruthy()
  })

  it('cancel button calls onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <NewItemDialog open={true} onOpenChange={onOpenChange} />,
      { wrapper }
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  describe('From template flow (project)', () => {
    it('shows "From template" button when project is selected', async () => {
      renderDialog()
      expect(screen.getByRole('button', { name: /from template/i })).toBeTruthy()
    })

    it('clicking "From template" reveals template selector', async () => {
      const user = userEvent.setup()
      renderDialog()
      await user.click(screen.getByRole('button', { name: /from template/i }))
      await waitFor(() => expect(screen.getByLabelText(/template/i)).toBeTruthy())
    })

    it('selecting template auto-fills title', async () => {
      const user = userEvent.setup()
      renderDialog()
      await user.click(screen.getByRole('button', { name: /from template/i }))
      const select = await screen.findByLabelText(/template/i)
      await user.selectOptions(select, '1')
      await waitFor(() => {
        const titleInput = screen.getByLabelText(/^title/i)
        expect((titleInput as HTMLInputElement).value).toBe('Sprint Kickoff')
      })
    })

    it('changing start date updates live preview', async () => {
      const user = userEvent.setup()
      renderDialog()
      await user.click(screen.getByRole('button', { name: /from template/i }))
      const select = await screen.findByLabelText(/template/i)
      await user.selectOptions(select, '1')
      // Wait for preview to appear
      await waitFor(() => expect(screen.getByText('Task A')).toBeTruthy())
      // Start date input has aria-label
      const startDateInput = screen.getByLabelText(/start date/i)
      expect(startDateInput).toBeTruthy()
    })

    it('create from template calls createProjectFromTemplate', async () => {
      const user = userEvent.setup()
      const onCreated = vi.fn()
      render(
        <NewItemDialog open={true} onOpenChange={() => {}} onCreated={onCreated} />,
        { wrapper }
      )
      await user.click(screen.getByRole('button', { name: /from template/i }))
      const select = await screen.findByLabelText(/template/i)
      await user.selectOptions(select, '1')
      await waitFor(() => screen.getByLabelText(/^title/i))
      await user.click(screen.getByRole('button', { name: /create project/i }))
      await waitFor(() => expect(mockCreateFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 1,
          payload: expect.objectContaining({ title: 'Sprint Kickoff' }),
        })
      ))
      expect(onCreated).toHaveBeenCalledWith(77)
    })
  })
})

