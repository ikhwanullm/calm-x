/**
 * WCAG AA contrast ratio tests for all Calm-X design tokens.
 *
 * Formula: relative luminance L = 0.2126R + 0.7152G + 0.0722B
 * (where R, G, B are linearized from sRGB).
 * Contrast ratio = (L_lighter + 0.05) / (L_darker + 0.05)
 *
 * WCAG AA requirements:
 *   - Normal text (< 18pt / < 14pt bold): ≥ 4.5:1
 *   - Large text (≥ 18pt / ≥ 14pt bold) and UI boundaries: ≥ 3:1
 *
 * We test:
 *   - Text tokens on their background tokens
 *   - Status foreground tokens on their background tokens
 *   - Accent text on accent-soft (active nav)
 *   - Accent-fg on accent (button text)
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// WCAG utilities
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linearize) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ---------------------------------------------------------------------------
// Token values (from index.css :root and .dark)
// ---------------------------------------------------------------------------

const LIGHT = {
  bg: '#F6F6F3',
  surface: '#FFFFFF',
  surface2: '#EFEFEA',
  border: '#E3E3DE',         // Decorative borders (cards, dividers) — 1.2:1 (see note)
  borderStrong: '#8A8A85',   // NEW: form control borders — ≥3.0:1 vs light --bg
  text: '#1B1B19',
  muted: '#5C5C57',
  accent: '#3B5BDB',
  accentFg: '#FFFFFF',
  accentSoft: '#EEF2FF',
  accentText: '#3049B8',
  dangerBg: '#FEF1F0',
  dangerFg: '#B42318',
  warnBg: '#FFF4E0',
  warnFg: '#8A4B00',
  okBg: '#EBF8F0',
  okFg: '#106B3E',
}

const DARK = {
  bg: '#131312',
  surface: '#1B1B1A',
  surface2: '#2A2A27',
  border: '#2F2F2C',        // Reverted: decorative borders (cards, dividers)
  borderStrong: '#6A6A67',  // NEW: form control borders — 3.5:1 vs dark --bg
  text: '#ECECE8',
  muted: '#A6A6A0',
  accent: '#8EA2FF',
  accentFg: '#10142B',
  accentSoft: '#1F2547',
  accentText: '#AEBBFF',
  dangerBg: '#3A1614',
  dangerFg: '#FFA59C',
  warnBg: '#352509',
  warnFg: '#F7C35F',
  okBg: '#0F2A1B',
  okFg: '#7BDCA6',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WCAG AA contrast ratios', () => {
  // Helper assertion: ≥ 4.5:1 for normal text
  function assertNormalText(fg: string, bg: string, label: string) {
    const ratio = contrastRatio(fg, bg)
    expect(ratio, `${label}: expected ≥ 4.5:1, got ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  }

  // Helper assertion: ≥ 3:1 for large text / UI boundaries
  function assertLargeOrUI(fg: string, bg: string, label: string) {
    const ratio = contrastRatio(fg, bg)
    expect(ratio, `${label}: expected ≥ 3:1, got ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3.0)
  }

  // ── Light theme ──────────────────────────────────────────────────────────

  it('light: --text on --bg (primary body text)', () => {
    assertNormalText(LIGHT.text, LIGHT.bg, 'light text/bg')
  })

  it('light: --text on --surface (cards, dialogs)', () => {
    assertNormalText(LIGHT.text, LIGHT.surface, 'light text/surface')
  })

  it('light: --muted on --bg (secondary text)', () => {
    assertNormalText(LIGHT.muted, LIGHT.bg, 'light muted/bg')
  })

  it('light: --muted on --surface', () => {
    assertNormalText(LIGHT.muted, LIGHT.surface, 'light muted/surface')
  })

  it('light: --accent-text on --accent-soft (active nav)', () => {
    assertNormalText(LIGHT.accentText, LIGHT.accentSoft, 'light accent-text/accent-soft')
  })

  it('light: --accent-fg on --accent (primary buttons)', () => {
    assertNormalText(LIGHT.accentFg, LIGHT.accent, 'light accent-fg/accent')
  })

  it('light: --danger-fg on --danger-bg (status badges)', () => {
    assertNormalText(LIGHT.dangerFg, LIGHT.dangerBg, 'light danger-fg/danger-bg')
  })

  it('light: --warn-fg on --warn-bg', () => {
    assertNormalText(LIGHT.warnFg, LIGHT.warnBg, 'light warn-fg/warn-bg')
  })

  it('light: --ok-fg on --ok-bg', () => {
    assertNormalText(LIGHT.okFg, LIGHT.okBg, 'light ok-fg/ok-bg')
  })

  it('light: --text on --surface-2 (chips, tags)', () => {
    assertNormalText(LIGHT.text, LIGHT.surface2, 'light text/surface-2')
  })

  // ── Dark theme ───────────────────────────────────────────────────────────

  it('dark: --text on --bg', () => {
    assertNormalText(DARK.text, DARK.bg, 'dark text/bg')
  })

  it('dark: --text on --surface', () => {
    assertNormalText(DARK.text, DARK.surface, 'dark text/surface')
  })

  it('dark: --muted on --bg', () => {
    assertNormalText(DARK.muted, DARK.bg, 'dark muted/bg')
  })

  it('dark: --muted on --surface', () => {
    assertNormalText(DARK.muted, DARK.surface, 'dark muted/surface')
  })

  it('dark: --accent-text on --accent-soft (active nav)', () => {
    assertNormalText(DARK.accentText, DARK.accentSoft, 'dark accent-text/accent-soft')
  })

  it('dark: --accent-fg on --accent (primary buttons)', () => {
    assertNormalText(DARK.accentFg, DARK.accent, 'dark accent-fg/accent')
  })

  it('dark: --danger-fg on --danger-bg', () => {
    assertNormalText(DARK.dangerFg, DARK.dangerBg, 'dark danger-fg/danger-bg')
  })

  it('dark: --warn-fg on --warn-bg', () => {
    assertNormalText(DARK.warnFg, DARK.warnBg, 'dark warn-fg/warn-bg')
  })

  it('dark: --ok-fg on --ok-bg', () => {
    assertNormalText(DARK.okFg, DARK.okBg, 'dark ok-fg/ok-bg')
  })

  it('dark: --text on --surface-2', () => {
    assertNormalText(DARK.text, DARK.surface2, 'dark text/surface-2')
  })

  // ── Border/UI boundaries ────────────────────────────────────────────────

  it('light: --border on --bg (decorative — 1.2:1, compensated by card shadow)', () => {
    const ratio = contrastRatio(LIGHT.border, LIGHT.bg)
    expect(ratio).toBeGreaterThan(1.0)
    // eslint-disable-next-line no-console
    console.info(`Light --border/bg: ${ratio.toFixed(2)}:1 (decorative; cards also have --shadow)`)
  })

  it('dark: --border on --bg (decorative — restored to #2F2F2C)', () => {
    // Decorative border — cards/dividers. 1.38:1, below 3:1 for UI boundaries.
    // Form controls use --border-strong instead.
    const ratio = contrastRatio(DARK.border, DARK.bg)
    expect(ratio).toBeGreaterThan(1.0)
    // eslint-disable-next-line no-console
    console.info(`Dark --border/bg: ${ratio.toFixed(2)}:1 (decorative; form controls use --border-strong)`)
  })

  it('light: --border-strong on --bg (form controls — WCAG AA ≥3:1)', () => {
    assertLargeOrUI(LIGHT.borderStrong, LIGHT.bg, 'light border-strong/bg')
  })

  it('light: --border-strong on --surface (form controls inside cards)', () => {
    assertLargeOrUI(LIGHT.borderStrong, LIGHT.surface, 'light border-strong/surface')
  })

  it('dark: --border-strong on --bg (form controls — WCAG AA ≥3:1)', () => {
    assertLargeOrUI(DARK.borderStrong, DARK.bg, 'dark border-strong/bg')
  })

  it('dark: --border-strong on --surface', () => {
    assertLargeOrUI(DARK.borderStrong, DARK.surface, 'dark border-strong/surface')
  })
})
