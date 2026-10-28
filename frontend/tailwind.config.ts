import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ---- Calm-X design tokens (ui-guidelines.md §3) ----
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        'accent-soft': 'var(--accent-soft)',
        'accent-text': 'var(--accent-text)',
        'danger-bg': 'var(--danger-bg)',
        'danger-fg': 'var(--danger-fg)',
        'warn-bg': 'var(--warn-bg)',
        'warn-fg': 'var(--warn-fg)',
        'ok-bg': 'var(--ok-bg)',
        'ok-fg': 'var(--ok-fg)',
        track: 'var(--track)',

        // ---- shadcn/ui key aliases (map directly to tokens, no hsl() wrapper) ----
        // Generated shadcn components use these names; they resolve to the same tokens.
        background: 'var(--bg)',
        foreground: 'var(--text)',
        card: 'var(--surface)',
        'card-foreground': 'var(--text)',
        popover: 'var(--surface)',
        'popover-foreground': 'var(--text)',
        primary: 'var(--accent)',
        'primary-foreground': 'var(--accent-fg)',
        secondary: 'var(--surface-2)',
        'secondary-foreground': 'var(--text)',
        'muted-foreground': 'var(--muted)',
        destructive: 'var(--danger-fg)',
        'destructive-foreground': 'var(--accent-fg)',
        input: 'var(--border)',
        ring: 'var(--accent)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
      borderRadius: {
        control: '8px',
        card: '12px',
        dialog: '14px',
        pill: '999px',
      },
    },
  },
  plugins: [],
}

export default config
