import { describe, it, expect } from 'vitest'
import { router } from '../router'

describe('Router configuration', () => {
  it('has a root layout route and a focused review route', () => {
    // First route: AppShell with children
    expect(router.routes[0].children).toBeDefined()
    // Second route: /review outside AppShell (focused layout)
    const reviewRoute = router.routes.find(r => r.path === '/review')
    expect(reviewRoute).toBeDefined()
  })

  it('contains all expected paths', () => {
    const children = router.routes[0].children ?? []
    const paths = children.map((r) => r.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/inbox')
    expect(paths).toContain('/someday')
    expect(paths).toContain('/meetings')
    expect(paths).toContain('/meetings/:id')
    expect(paths).toContain('/projects')
    expect(paths).toContain('/projects/:id')
    expect(paths).toContain('/areas')
    expect(paths).toContain('/archive')
    expect(paths).toContain('/settings')
    // /review is at top level (outside AppShell), not in children
    const reviewInChildren = paths.includes('/review')
    expect(reviewInChildren).toBe(false)
    const topLevelReview = router.routes.find(r => r.path === '/review')
    expect(topLevelReview).toBeDefined()
  })
})
