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
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
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
