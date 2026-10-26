import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Design tokens', () => {
  const css = readFileSync(resolve(__dirname, '../../src/index.css'), 'utf-8')

  it('contains light mode tokens', () => {
    expect(css).toContain('--bg: #F6F6F3')
    expect(css).toContain('--accent: #3B5BDB')
    expect(css).toContain('--danger-fg: #B42318')
  })

  it('contains dark mode tokens', () => {
    expect(css).toContain('.dark')
    expect(css).toContain('--bg: #131312')
    expect(css).toContain('--accent: #8EA2FF')
  })

  it('contains shadcn variable mapping', () => {
    expect(css).toContain('--background: var(--bg)')
    expect(css).toContain('--primary: var(--accent)')
    expect(css).toContain('--ring: var(--accent)')
  })

  it('does not contain unused --accent-shadcn', () => {
    expect(css).not.toContain('--accent-shadcn')
  })
})

describe('shadcn token mapping in tailwind.config', () => {
  // We test via dynamic import since tailwind.config.ts is an ES module
  it('exports a config with shadcn background key', async () => {
    const mod = await import('../../tailwind.config')
    const colors = (mod.default.theme?.extend?.colors ?? {}) as Record<string, string>
    expect(colors['background']).toBe('var(--bg)')
    expect(colors['primary']).toBe('var(--accent)')
    expect(colors['destructive']).toBe('var(--danger-fg)')
    expect(colors['ring']).toBe('var(--accent)')
    expect(colors['input']).toBe('var(--border)')
    expect(colors['secondary']).toBe('var(--surface-2)')
  })
})
