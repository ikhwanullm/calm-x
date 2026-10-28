import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../api/tasks', () => ({
  tasksApi: { delete: vi.fn().mockResolvedValue({}), restore: vi.fn() },
}))
vi.mock('../api/subtasks', () => ({
  subtasksApi: { delete: vi.fn().mockResolvedValue({}), restore: vi.fn().mockResolvedValue({ id: 11 }) },
}))

import { notify } from '../lib/toast'
import { tasksApi } from '../api/tasks'
import { subtasksApi } from '../api/subtasks'
import { useDeleteTask, taskKeys, UNDO_TOAST_MS } from '../hooks/useTasks'
import { useDeleteSubtask } from '../hooks/useSubtasks'

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

type ToastOptions = { action: { label: string; onClick: () => void }; duration: number }

function lastToastOptions(): ToastOptions {
  const calls = vi.mocked(notify.success).mock.calls
  return calls[calls.length - 1][1] as unknown as ToastOptions
}

describe('Undo after delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers Undo after deleting a task and restores it', async () => {
    const { wrapper } = setup()
    vi.mocked(tasksApi.restore).mockResolvedValue({ id: 5, item_id: 3 } as never)
    const { result } = renderHook(() => useDeleteTask(), { wrapper })

    act(() => result.current.mutate(5))
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Task deleted', expect.anything()))
    const options = lastToastOptions()
    expect(options.action.label).toBe('Undo')
    expect(options.duration).toBe(UNDO_TOAST_MS)

    act(() => options.action.onClick())
    await waitFor(() => expect(tasksApi.restore).toHaveBeenCalledWith(5))
    await waitFor(() => expect(notify.success).toHaveBeenLastCalledWith('Task restored'))
  })

  it('says when a restored task landed in the Inbox', async () => {
    const { qc, wrapper } = setup()
    qc.setQueryData(taskKeys.detail(5), { id: 5, item_id: 3 })
    vi.mocked(tasksApi.restore).mockResolvedValue({ id: 5, item_id: null } as never)
    const { result } = renderHook(() => useDeleteTask(), { wrapper })

    act(() => result.current.mutate(5))
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Task deleted', expect.anything()))
    act(() => lastToastOptions().action.onClick())
    await waitFor(() =>
      expect(notify.success).toHaveBeenLastCalledWith(expect.stringMatching(/restored to the Inbox/))
    )
  })

  it('reports a failed restore', async () => {
    const { wrapper } = setup()
    vi.mocked(tasksApi.restore).mockRejectedValue(new Error('undo window has passed'))
    const { result } = renderHook(() => useDeleteTask(), { wrapper })

    act(() => result.current.mutate(5))
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    act(() => lastToastOptions().action.onClick())
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith("Couldn't restore the task.", 'undo window has passed')
    )
  })

  it('offers Undo after deleting a subtask and restores it', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useDeleteSubtask(1), { wrapper })

    act(() => result.current.mutate(11))
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Subtask deleted', expect.anything()))
    act(() => lastToastOptions().action.onClick())
    await waitFor(() => expect(subtasksApi.restore).toHaveBeenCalledWith(11))
    await waitFor(() => expect(notify.success).toHaveBeenLastCalledWith('Subtask restored'))
  })
})
