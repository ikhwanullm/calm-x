import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '../components/ThemeProvider'

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

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('defaults to system theme', () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('applies dark class when theme is dark', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    await user.click(screen.getByText('set dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('removes dark class when theme is light', async () => {
    const user = userEvent.setup()
    document.documentElement.classList.add('dark')
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    await user.click(screen.getByText('set light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('persists theme to localStorage', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    await user.click(screen.getByText('set dark'))
    expect(localStorage.getItem('calm-x-theme')).toBe('dark')
  })

  it('reads persisted theme on mount', () => {
    localStorage.setItem('calm-x-theme', 'dark')
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>
    )
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('throws when useTheme used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ThemeDisplay />)).toThrow('useTheme must be used within a ThemeProvider')
    consoleSpy.mockRestore()
  })
})
