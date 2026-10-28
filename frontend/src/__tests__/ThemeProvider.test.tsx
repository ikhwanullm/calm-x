import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, useTheme } from '../components/ThemeProvider'

// Mock settingsApi so ThemeProvider's backend sync does not make real requests
vi.mock('../api/settings', () => ({
  settingsApi: {
    get: vi.fn().mockResolvedValue({ approaching_deadline_threshold: '3' }),
    update: vi.fn().mockResolvedValue({}),
  },
}))

// Helper component to read context values
function ThemeDisplay() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>set dark</button>
      <button onClick={() => setTheme('light')}>set light</button>
      <button onClick={() => setTheme('system')}>set system</button>
    </div>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('defaults to system theme', () => {
    render(<Wrapper><ThemeProvider><ThemeDisplay /></ThemeProvider></Wrapper>)
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('applies dark class when theme is dark', async () => {
    const user = userEvent.setup()
    render(<Wrapper><ThemeProvider><ThemeDisplay /></ThemeProvider></Wrapper>)
    await user.click(screen.getByText('set dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('removes dark class when theme is light', async () => {
    const user = userEvent.setup()
    document.documentElement.classList.add('dark')
    render(<Wrapper><ThemeProvider><ThemeDisplay /></ThemeProvider></Wrapper>)
    await user.click(screen.getByText('set light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('persists theme to localStorage', async () => {
    const user = userEvent.setup()
    render(<Wrapper><ThemeProvider><ThemeDisplay /></ThemeProvider></Wrapper>)
    await user.click(screen.getByText('set dark'))
    expect(localStorage.getItem('calm-x-theme')).toBe('dark')
  })

  it('reads persisted theme on mount', () => {
    localStorage.setItem('calm-x-theme', 'dark')
    render(<Wrapper><ThemeProvider><ThemeDisplay /></ThemeProvider></Wrapper>)
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('throws when useTheme used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ThemeDisplay />)).toThrow('useTheme must be used within a ThemeProvider')
    consoleSpy.mockRestore()
  })
})
