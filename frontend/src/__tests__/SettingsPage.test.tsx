import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsPage from '../pages/SettingsPage'

const mockUpdateSettings = vi.fn().mockResolvedValue({
  approaching_deadline_threshold: '7',
  theme: 'dark',
})

vi.mock('../hooks/useSettings', () => ({
  useSettings: () => ({
    data: { approaching_deadline_threshold: '3', theme: 'system' },
    isLoading: false,
  }),
  useUpdateSettings: () => ({
    mutate: mockUpdateSettings,
    mutateAsync: mockUpdateSettings,
    isPending: false,
  }),
}))

vi.mock('../hooks/useTags', () => ({
  useTags: () => ({ data: [{ id: 1, name: 'work', created_at: '' }] }),
  useCreateTag: () => ({ mutate: vi.fn(), isPending: false }),
  useRenameTag: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTag: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn(), resolvedTheme: 'light' }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SettingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders Settings heading', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByRole('heading', { name: /settings/i, level: 1 })).toBeTruthy()
  })

  it('shows Appearance section with theme options', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByText('Appearance')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /system/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /light/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /dark/i })).toBeTruthy()
  })

  it('System theme radio is checked by default', () => {
    render(<SettingsPage />, { wrapper })
    const systemRadio = screen.getByRole('radio', { name: /system/i })
    expect(systemRadio).toHaveProperty('checked', true)
  })

  it('shows Deadline threshold section', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByText('Deadline threshold')).toBeTruthy()
    expect(screen.getByRole('spinbutton', { name: /threshold/i })).toBeTruthy()
  })

  it('shows current threshold value', () => {
    render(<SettingsPage />, { wrapper })
    const input = screen.getByRole('spinbutton', { name: /threshold/i }) as HTMLInputElement
    expect(input.value).toBe('3')
  })

  it('shows error for out-of-range threshold', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />, { wrapper })
    const input = screen.getByRole('spinbutton', { name: /threshold/i })
    await user.clear(input)
    await user.type(input, '50')
    await waitFor(() => {
      expect(screen.getByText(/must be between 1 and 30/i)).toBeTruthy()
    })
  })

  it('shows Tags section', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByText('Tags')).toBeTruthy()
    expect(screen.getByText('#work')).toBeTruthy()
  })

  it('shows Data section with Export and Import', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByText('Data')).toBeTruthy()
    expect(screen.getByRole('button', { name: /export json/i })).toBeTruthy()
    expect(screen.getByLabelText(/choose json file/i)).toBeTruthy()
  })

  it('shows Merge and Replace import mode options', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByRole('radio', { name: /merge/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /replace/i })).toBeTruthy()
  })

  it('shows Backups section heading', () => {
    render(<SettingsPage />, { wrapper })
    expect(screen.getByText('Backups')).toBeTruthy()
    expect(screen.getByRole('button', { name: /create backup now/i })).toBeTruthy()
  })
})
