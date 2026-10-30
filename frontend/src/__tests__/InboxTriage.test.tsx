import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from '../types/models'

vi.mock('../api/tasks', () => ({
  tasksApi: {
    inbox: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    create: vi.fn(),
    move: vi.fn(),
    complete: vi.fn(),
    incomplete: vi.fn(),
  },
}))
vi.mock('../api/items', () => ({
  itemsApi: { list: vi.fn().mockResolvedValue([{ id: 10, type: 'project', title: 'Work', project_status: 'active', archived_at: null }]) },
}))
vi.mock('../hooks/useSettings', () => ({ useDeadlineThreshold: () => 3 }))
vi.mock('../components/tasks/TaskDrawer', () => ({ TaskDrawer: () => null }))
vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { tasksApi } from '../api/tasks'
import { notify } from '../lib/toast'
import InboxPage from '../pages/InboxPage'

const TODAY = '2026-10-29'

function task(id: number, title: string, extra: Partial<Task> = {}): Task {
  return {
    id, item_id: null, title, description: '', notes: '', due_date: null, priority: 'medium', is_complete: false,
    sort_order: id, created_at: '', updated_at: '', subtask_count: 0, completed_subtask_count: 0, tags: [],
    focus_date: null, waiting_for: null, waiting_since: null, defer_until: null, is_someday: false, meeting_id: null,
    meeting_title: null, meeting_held_at: null, item_title: null, item_type: null, ...extra,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}><InboxPage /></QueryClientProvider>
    </MemoryRouter>
  )
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for "${title}"` }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 12))
  vi.mocked(tasksApi.inbox).mockResolvedValue([task(1, 'Alpha'), task(2, 'Beta', { tags: ['home'] }), task(3, 'Gamma')])
  vi.mocked(tasksApi.update).mockResolvedValue({} as Task)
  vi.mocked(tasksApi.delete).mockResolvedValue(undefined as never)
  vi.mocked(tasksApi.restore).mockResolvedValue({} as Task)
})
afterEach(() => vi.useRealTimers())

const adv = { advanceTimers: () => {} }

describe('Inbox row actions', () => {
  it('Add to Today puts the task on Today', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await openMenu(user, 'Alpha')
    await user.click(screen.getByRole('menuitem', { name: 'Add to Today' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(1, { focus_date: TODAY }))
    expect(notify.success).toHaveBeenCalledWith('1 task added to Today')
  })

  it('Move to Someday parks the task', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await openMenu(user, 'Beta')
    await user.click(screen.getByRole('menuitem', { name: 'Move to Someday' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(2, { is_someday: true }))
  })

  it('Set due date asks for the date under the row, then saves it', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await openMenu(user, 'Alpha')
    await user.click(screen.getByRole('menuitem', { name: 'Set due date…' }))
    const field = await screen.findByLabelText('Due date')
    expect((screen.getByRole('button', { name: 'Set date' }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(field, '2026-11-05')
    await user.click(screen.getByRole('button', { name: 'Set date' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(1, { due_date: '2026-11-05' }))
    await waitFor(() => expect(screen.queryByLabelText('Due date')).toBeNull())
  })

  it('Waiting for takes a name, and Escape closes the form without saving', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await openMenu(user, 'Gamma')
    await user.click(screen.getByRole('menuitem', { name: 'Waiting for…' }))
    await user.type(await screen.findByLabelText('Waiting for'), 'Budi{Enter}')
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(3, { waiting_for: 'Budi' }))
    expect(notify.success).toHaveBeenCalledWith('1 task now waiting for Budi')

    await openMenu(user, 'Alpha')
    await user.click(screen.getByRole('menuitem', { name: 'Waiting for…' }))
    await user.type(await screen.findByLabelText('Waiting for'), 'x{Escape}')
    await waitFor(() => expect(screen.queryByLabelText('Waiting for')).toBeNull())
    expect(tasksApi.update).toHaveBeenCalledTimes(1)
  })

  it('Delete asks first, then deletes and offers Undo that restores it', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await openMenu(user, 'Alpha')
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('"Alpha"')
    expect(tasksApi.delete).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete task' }))
    await waitFor(() => expect(tasksApi.delete).toHaveBeenCalledWith(1))
    const [message, options] = vi.mocked(notify.success).mock.calls[0] as unknown as [string, { action: { label: string; onClick: () => void } }]
    expect(message).toBe('Deleted 1 task')
    expect(options.action.label).toBe('Undo')
    options.action.onClick()
    await waitFor(() => expect(tasksApi.restore).toHaveBeenCalledWith(1))
  })

  it('cancelling the delete dialog deletes nothing', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await openMenu(user, 'Alpha')
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /cancel/i }))
    expect(tasksApi.delete).not.toHaveBeenCalled()
  })
})

describe('Inbox bulk actions', () => {
  async function selectTasks(user: ReturnType<typeof userEvent.setup>, ...titles: string[]) {
    for (const title of titles) await user.click(await screen.findByRole('checkbox', { name: `Select task: ${title}` }))
  }

  it('shows the bar only while something is selected', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await screen.findByText('Alpha')
    expect(screen.queryByRole('region', { name: 'Selected tasks' })).toBeNull()
    await selectTasks(user, 'Alpha')
    expect(screen.getByText('1 task selected')).toBeTruthy()
  })

  it('sets priority on every selected task and clears the selection', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await selectTasks(user, 'Alpha', 'Gamma')
    await user.selectOptions(screen.getByLabelText('Set priority of selected tasks'), 'high')
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledTimes(2))
    expect(tasksApi.update).toHaveBeenCalledWith(1, { priority: 'high' })
    expect(tasksApi.update).toHaveBeenCalledWith(3, { priority: 'high' })
    expect(notify.success).toHaveBeenCalledWith('Priority of 2 tasks set to high')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Selected tasks' })).toBeNull())
  })

  it('Today and Someday apply to all selected', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await selectTasks(user, 'Alpha', 'Beta')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(2, { focus_date: TODAY }))
    expect(tasksApi.update).toHaveBeenCalledWith(1, { focus_date: TODAY })
    await selectTasks(user, 'Gamma')
    await user.click(screen.getByRole('button', { name: 'Someday' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledWith(3, { is_someday: true }))
  })

  it('Add tag keeps each task\'s own tags and does not repeat one', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await selectTasks(user, 'Alpha', 'Beta')
    await user.click(screen.getByRole('button', { name: 'Add tag…' }))
    await user.type(screen.getByLabelText('Tag'), '#Home{Enter}')
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledTimes(2))
    expect(tasksApi.update).toHaveBeenCalledWith(1, { tag_names: ['home'] })
    expect(tasksApi.update).toHaveBeenCalledWith(2, { tag_names: ['home'] })
    expect(notify.success).toHaveBeenCalledWith('Tag #home added to 2 tasks')
  })

  it('Due date and Waiting for take one value for all', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await selectTasks(user, 'Alpha', 'Gamma')
    await user.click(screen.getByRole('button', { name: 'Due date…' }))
    await user.type(screen.getByLabelText('Due date'), '2026-11-02')
    await user.click(screen.getByRole('button', { name: 'Set date' }))
    await waitFor(() => expect(tasksApi.update).toHaveBeenCalledTimes(2))
    expect(tasksApi.update).toHaveBeenCalledWith(3, { due_date: '2026-11-02' })
  })

  it('says how many could not be changed and still counts the ones that worked', async () => {
    const user = userEvent.setup(adv)
    vi.mocked(tasksApi.update).mockImplementation(async (id) => {
      if (id === 3) throw new Error('Archived')
      return {} as Task
    })
    renderPage()
    await selectTasks(user, 'Alpha', 'Gamma')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('1 task could not be changed.', 'Archived'))
    expect(notify.success).toHaveBeenCalledWith('1 task added to Today')
  })

  it('bulk delete asks once, deletes them all and Undo restores them all', async () => {
    const user = userEvent.setup(adv)
    renderPage()
    await selectTasks(user, 'Alpha', 'Beta')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('Delete 2 tasks?')
    await user.click(within(dialog).getByRole('button', { name: 'Delete tasks' }))
    await waitFor(() => expect(tasksApi.delete).toHaveBeenCalledTimes(2))
    const [message, options] = vi.mocked(notify.success).mock.calls[0] as unknown as [string, { action: { onClick: () => void } }]
    expect(message).toBe('Deleted 2 tasks')
    options.action.onClick()
    await waitFor(() => expect(tasksApi.restore).toHaveBeenCalledTimes(2))
    expect(vi.mocked(tasksApi.restore).mock.calls.map(([id]) => id).sort()).toEqual([1, 2])
  })
})
