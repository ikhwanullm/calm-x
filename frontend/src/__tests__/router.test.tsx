import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { router } from '../router'

// Test each route renders without crashing using a memory router
const routes = router.routes

function renderRoute(path: string) {
  const memRouter = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={memRouter} />)
}

describe('Router routes', () => {
  it('renders dashboard at /', () => {
    renderRoute('/')
    expect(screen.getByText('Dashboard')).toBeTruthy()
  })

  it('renders inbox at /inbox', () => {
    renderRoute('/inbox')
    expect(screen.getByText('Inbox')).toBeTruthy()
  })

  it('renders projects at /projects', () => {
    renderRoute('/projects')
    expect(screen.getByText('Projects')).toBeTruthy()
  })

  it('renders project detail at /projects/:id', () => {
    renderRoute('/projects/123')
    expect(screen.getByText(/project detail/i)).toBeTruthy()
  })

  it('renders areas at /areas', () => {
    renderRoute('/areas')
    expect(screen.getByText('Areas')).toBeTruthy()
  })

  it('renders archive at /archive', () => {
    renderRoute('/archive')
    expect(screen.getByText('Archive')).toBeTruthy()
  })

  it('renders settings at /settings', () => {
    renderRoute('/settings')
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('renders weekly review at /review', () => {
    renderRoute('/review')
    expect(screen.getByText(/weekly review/i)).toBeTruthy()
  })
})
