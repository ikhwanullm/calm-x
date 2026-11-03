import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('../api/tasks', () => ({
  tasksApi: { complete: vi.fn(), undoComplete: vi.fn() },
}))
vi.mock('../lib/toast', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}))

import { tasksApi } from '../api/tasks'
import { notify } from '../lib/toast'
import { UNDO_TOAST_MS, useCompleteTask } from '../hooks/useTasks'

function setup(options?: { quiet?: boolean }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return renderHook(() => useCompleteTask(options), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(tasksApi.complete).mockResolvedValue({} as never)
})

describe('Undo after completing a task', () => {
  it('shows "Task completed" with an Undo that reopens the task', async () => {
    vi.mocked(tasksApi.undoComplete).mockResolvedValue({} as never)
    const { result } = setup()
    await act(async () => { result.current.mutate(7) })
    await waitFor(() => expect(notify.success).toHaveBeenCalledTimes(1))
    const [message, options] = vi.mocked(notify.success).mock.calls[0] as [string, { action: { label: string; onClick: () => void }; duration: number }]
    expect(message).toBe('Task completed')
    expect(options.action.label).toBe('Undo')
    expect(options.duration).toBe(UNDO_TOAST_MS)

    await act(async () => { options.action.onClick() })
    expect(tasksApi.undoComplete).toHaveBeenCalledWith(7)
    await waitFor(() => expect(notify.success).toHaveBeenLastCalledWith('Task reopened'))
  })

  it('says why when the task changed and Undo is refused', async () => {
    vi.mocked(tasksApi.undoComplete).mockRejectedValue(new Error('409'))
    const { result } = setup()
    await act(async () => { result.current.mutate(7) })
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    const options = vi.mocked(notify.success).mock.calls[0][1] as { action: { onClick: () => void } }
    await act(async () => { options.action.onClick() })
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Couldn't undo: the task changed"))
  })

  it('shows no toast in quiet mode (Weekly Review steps)', async () => {
    const { result } = setup({ quiet: true })
    await act(async () => { result.current.mutate(7) })
    await waitFor(() => expect(tasksApi.complete).toHaveBeenCalled())
    expect(notify.success).not.toHaveBeenCalled()
  })
})
