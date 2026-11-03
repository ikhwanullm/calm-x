import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { installStaleBuildReload, page, reloadOnceForNewBuild } from '../lib/staleBuild'
import { RouteError } from '../components/layout/RouteError'

const reload = vi.fn()

beforeEach(() => {
  reload.mockClear()
  sessionStorage.clear()
  vi.spyOn(page, 'reload').mockImplementation(reload)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reloadOnceForNewBuild', () => {
  it('reloads the first time', () => {
    expect(reloadOnceForNewBuild(1_000_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again right away, so a real failure cannot loop', () => {
    reloadOnceForNewBuild(1_000_000)
    expect(reloadOnceForNewBuild(1_005_000)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads again once enough time has passed', () => {
    reloadOnceForNewBuild(1_000_000)
    expect(reloadOnceForNewBuild(1_020_000)).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})

describe('installStaleBuildReload', () => {
  it('reloads when Vite cannot fetch a lazily loaded file', () => {
    installStaleBuildReload()
    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('RouteError', () => {
  it('tells the owner Calm-X was updated and offers a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([
      {
        path: '/',
        element: <p>never shown</p>,
        loader: () => {
          throw new Error('Failed to fetch dynamically imported module')
        },
        errorElement: <RouteError />,
      },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Calm-X was updated.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalled()
  })
})
