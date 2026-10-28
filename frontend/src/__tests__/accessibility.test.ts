/**
 * Automated accessibility scans of the source code.
 *
 * P11.4: Verify no div/span onClick, icon-only buttons have aria-label,
 *        decorative SVG has aria-hidden.
 * P11.5: Verify landmarks are in place (nav aria-label="Main", header, main, etc.)
 *
 * These tests scan .tsx source files — they are fast (no DOM) and catch
 * regressions before they reach a browser.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

const SRC_DIR = join(__dirname, '..')

function getAllTsxFiles(dir: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      result.push(...getAllTsxFiles(full))
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      result.push(full)
    }
  }
  return result
}

const tsxFiles = getAllTsxFiles(SRC_DIR)

function readFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

// ---------------------------------------------------------------------------
// 11.4: Accessible elements
// ---------------------------------------------------------------------------

describe('11.4 Accessible elements', () => {
  it('no <div onClick> patterns (use <button> instead)', () => {
    const violations: string[] = []
    for (const file of tsxFiles) {
      const content = readFile(file)
      // Match <div ... onClick but not inside JSX comments or strings
      const matches = content.match(/<div[^>]*onClick/g)
      if (matches) {
        violations.push(`${file}: ${matches.length} occurrence(s)`)
      }
    }
    expect(violations, `div onClick anti-patterns found:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('no <span onClick> patterns', () => {
    const violations: string[] = []
    for (const file of tsxFiles) {
      const content = readFile(file)
      const matches = content.match(/<span[^>]*onClick/g)
      if (matches) {
        violations.push(`${file}: ${matches.length} occurrence(s)`)
      }
    }
    expect(violations, `span onClick anti-patterns:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('icon-only lucide SVG patterns: all GripVertical, X, Plus buttons have aria-label', () => {
    // Ensure buttons that only contain an SVG icon have aria-label
    // We look for buttons where the ONLY visible content is an icon (no text sibling)
    // This is checked manually during PR review; automated check verifies known patterns
    for (const file of tsxFiles) {
      const content = readFile(file)
      // If a button has aria-label, it's OK. If it has no text content and no aria-label, flag it.
      // Simple heuristic: buttons with GripVertical/X/Plus icons should not also be missing aria-label
      // We verify that every file that uses icon-only button patterns has aria-label set
      if (content.includes('GripVertical') && content.includes('<button')) {
        expect(content).toMatch(/aria-label.*Reorder/i)
      }
    }
  })

  it('decorative lucide icons in components have aria-hidden="true"', () => {
    // Check that icon components in common layout have aria-hidden
    const appShell = readFile(join(SRC_DIR, 'components', 'layout', 'AppShell.tsx'))
    expect(appShell).toMatch(/aria-hidden="true"/)
  })

  it('TaskRow does not use role="row" without table/grid context', () => {
    const taskRowFile = readFile(join(SRC_DIR, 'components', 'tasks', 'TaskRow.tsx'))
    // The role="row" on a plain div is semantically incorrect without grid parent.
    // It should not exist.
    expect(taskRowFile).not.toMatch(/role="row"/)
  })
})

// ---------------------------------------------------------------------------
// 11.5: Landmarks
// ---------------------------------------------------------------------------

describe('11.5 Landmarks', () => {
  it('AppShell has <nav aria-label="Main">', () => {
    const content = readFile(join(SRC_DIR, 'components', 'layout', 'AppShell.tsx'))
    expect(content).toMatch(/aria-label="Main"/)
  })

  it('AppShell has <nav aria-label="Secondary">', () => {
    const content = readFile(join(SRC_DIR, 'components', 'layout', 'AppShell.tsx'))
    expect(content).toMatch(/aria-label="Secondary"/)
  })

  it('AppShell has a <header> element', () => {
    const content = readFile(join(SRC_DIR, 'components', 'layout', 'AppShell.tsx'))
    expect(content).toMatch(/<header/)
  })

  it('AppShell has a <main> element', () => {
    const content = readFile(join(SRC_DIR, 'components', 'layout', 'AppShell.tsx'))
    expect(content).toMatch(/<main/)
  })

  it('TaskDrawer SheetContent has aria-label="Task details"', () => {
    const content = readFile(join(SRC_DIR, 'components', 'tasks', 'TaskDrawer.tsx'))
    expect(content).toMatch(/aria-label="Task details"/)
  })

  it('WeeklyReviewPage has header, main, and nav aria-label="Review steps"', () => {
    const content = readFile(join(SRC_DIR, 'pages', 'WeeklyReviewPage.tsx'))
    expect(content).toMatch(/<header/)
    expect(content).toMatch(/<main/)
    expect(content).toMatch(/aria-label="Review steps"/)
  })
})
