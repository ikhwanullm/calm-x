import { describe, it, expect } from 'vitest'
import { router } from '../router'

describe('Router configuration', () => {
  it('has a root layout route', () => {
    expect(router.routes).toHaveLength(1)
    expect(router.routes[0].children).toBeDefined()
  })

  it('contains all expected paths', () => {
    const children = router.routes[0].children ?? []
    const paths = children.map((r) => r.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/inbox')
    expect(paths).toContain('/projects')
    expect(paths).toContain('/projects/:id')
    expect(paths).toContain('/areas')
    expect(paths).toContain('/archive')
    expect(paths).toContain('/review')
    expect(paths).toContain('/settings')
  })
})
