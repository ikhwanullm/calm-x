import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    // App renders RouterProvider + Toaster — just verify it mounts
    expect(() => render(<App />)).not.toThrow()
  })
})
