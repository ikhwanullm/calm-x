import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NewItemDialog } from '../components/items/NewItemDialog'

vi.mock('../hooks/useItems', () => ({
  useCreateItem: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 42 }),
    isPending: false,
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient()
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
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
})
