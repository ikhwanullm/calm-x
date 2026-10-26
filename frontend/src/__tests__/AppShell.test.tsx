import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'

function renderShell(path = '/') {
  const testRouter = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <div>Dashboard content</div> },
          { path: '/inbox', element: <div>Inbox content</div> },
        ],
      },
    ],
    { initialEntries: [path] }
  )
  return render(<RouterProvider router={testRouter} />)
}

describe('AppShell', () => {
  it('renders the main nav landmark', () => {
    renderShell()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
  })

  it('renders all primary nav links', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Inbox' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Projects' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Areas' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Resources' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Archive' })).toBeTruthy()
  })

  it('renders secondary nav links', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Templates' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Weekly review' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy()
  })

  it('renders header with search and quick capture', () => {
    renderShell()
    expect(screen.getByRole('banner')).toBeTruthy() // <header>
    expect(screen.getByRole('button', { name: 'Quick capture' })).toBeTruthy()
  })

  it('renders the page content outlet', () => {
    renderShell('/')
    expect(screen.getByText('Dashboard content')).toBeTruthy()
  })

  it('active dashboard link has aria-current="page"', () => {
    renderShell('/')
    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('shows inbox count pill when inboxCount > 0', () => {
    const testRouter = createMemoryRouter(
      [
        {
          element: <AppShell inboxCount={5} />,
          children: [{ path: '/', element: <div /> }],
        },
      ],
      { initialEntries: ['/'] }
    )
    render(<RouterProvider router={testRouter} />)
    expect(screen.getByLabelText('5 inbox items')).toBeTruthy()
  })
})
