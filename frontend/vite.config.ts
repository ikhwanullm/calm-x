/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Each test file still runs in its own isolated VM context (mocks do not leak between files), but a worker
    // creates jsdom once instead of once per file: the full suite went from about 220 s to about 35 s.
    pool: 'vmThreads',
    // Fewer workers than cores: with all of them busy a few heavy tests (ItemPicker, InboxTriage) overran the default
    // 5 s timeout now and then, so give them room as well.
    maxWorkers: 6,
    testTimeout: 15000,
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
