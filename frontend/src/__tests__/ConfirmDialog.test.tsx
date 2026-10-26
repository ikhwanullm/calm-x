import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '../components/common/ConfirmDialog'

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return render(
    <ConfirmDialog
      open={true}
      onOpenChange={() => {}}
      title="Delete project"
      description="This action cannot be undone."
      confirmLabel="Delete project"
      onConfirm={() => {}}
      {...props}
    />
  )
}

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: 'Delete project' })).toBeTruthy()
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy()
  })

  it('does not render when open=false', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Delete project')).toBeNull()
  })

  it('renders confirm button with correct label', () => {
    renderDialog({ confirmLabel: 'Delete project' })
    expect(screen.getByRole('button', { name: 'Delete project' })).toBeTruthy()
  })

  it('renders cancel button', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    await user.click(screen.getByRole('button', { name: 'Delete project' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('confirm button has danger styling when destructive=true', () => {
    renderDialog({ destructive: true })
    const confirmBtn = screen.getByRole('button', { name: 'Delete project' })
    expect(confirmBtn.className).toContain('text-danger-fg')
  })

  it('custom cancel label renders correctly', () => {
    renderDialog({ cancelLabel: 'Keep it' })
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeTruthy()
  })
})
