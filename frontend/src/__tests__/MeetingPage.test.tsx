import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Meeting, MeetingActions } from '../types/models'

vi.mock('../lib/toast', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../api/meetings', () => ({
  meetingsApi: {
    get: vi.fn(),
    update: vi.fn(),
    actions: vi.fn(),
    process: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}))

import { meetingsApi } from '../api/meetings'
import { notify } from '../lib/toast'
import MeetingPage from '../pages/MeetingPage'

const BODY = '## Actions\n- [ ] Send the report\n@Budi: send the logs\n? Who owns it?\n! Ship Friday\n'

function meeting(extra: Partial<Meeting> = {}): Meeting {
  return {
    id: 7, item_id: 3, item_title: 'Migrate CML', item_type: 'project', item_archived: false,
    title: 'Kickoff', held_at: '2026-10-28T03:00:00Z', attendees: 'Budi, Sari', processed_at: null,
    updated_at: '2026-10-28T03:00:00Z', open_action_count: 2, body: BODY, created_at: '2026-10-28T03:00:00Z',
    ...extra,
  }
}

const ACTIONS: MeetingActions = {
  actions: [
    { line: 1, kind: 'mine', text: 'Send the report', who: null },
    { line: 2, kind: 'waiting', text: 'send the logs', who: 'Budi' },
  ],
  questions: [{ line: 3, text: 'Who owns it?' }],
  decisions: [{ line: 4, text: 'Ship Friday' }],
  converted: 1,
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/meetings/7']}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/meetings/:id" element={<MeetingPage />} />
          <Route path="/projects/:id" element={<div>Project page</div>} />
          <Route path="/areas/:id" element={<div>Area page</div>} />
          <Route path="/meetings" element={<div>Meetings list</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const notes = () => screen.getByLabelText('Meeting notes') as HTMLTextAreaElement

describe('MeetingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting())
    vi.mocked(meetingsApi.actions).mockResolvedValue(ACTIONS)
    vi.mocked(meetingsApi.update).mockImplementation(async (_id, patch) => meeting(patch))
  })
  afterEach(() => vi.useRealTimers())

  it('shows the meeting, its notes and a link back to its project', async () => {
    renderPage()
    expect(((await screen.findByLabelText('Meeting title')) as HTMLInputElement).value).toBe('Kickoff')
    expect((screen.getByLabelText('Attendees') as HTMLInputElement).value).toBe('Budi, Sari')
    expect(notes().value).toBe(BODY)
    const back = screen.getByRole('link', { name: /Migrate CML/ })
    expect(back.getAttribute('href')).toBe('/projects/3')
  })

  it('links back to an area for area meetings', async () => {
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting({ item_type: 'area', item_id: 9 }))
    renderPage()
    await screen.findByLabelText('Meeting title')
    expect(screen.getByRole('link', { name: /Migrate CML/ }).getAttribute('href')).toBe('/areas/9')
  })

  it('lists the parsed actions, decisions and questions beside the notes', async () => {
    renderPage()
    const panel = await screen.findByRole('complementary', { name: 'Found in your notes' })
    await within(panel).findByText('Send the report')
    expect(within(panel).getByText('send the logs')).toBeTruthy()
    expect(within(panel).getByText('Ship Friday')).toBeTruthy()
    expect(within(panel).getByText('Who owns it?')).toBeTruthy()
    expect(within(panel).getByText('1 already turned into tasks')).toBeTruthy()
  })

  it('says so when the meeting does not exist', async () => {
    vi.mocked(meetingsApi.get).mockRejectedValue(new Error('404'))
    renderPage()
    expect(await screen.findByText(/could not be found/)).toBeTruthy()
  })

  it('previews the notes as Markdown and switches back to editing', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Meeting notes')
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('heading', { name: 'Actions' })).toBeTruthy()
    expect(screen.queryByLabelText('Meeting notes')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(notes().value).toBe(BODY)
  })

  describe('autosave', () => {
    it('saves typing after a pause and shows Saving then Saved', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      renderPage()
      await screen.findByLabelText('Meeting notes')
      fireEvent.change(notes(), { target: { value: 'new notes' } })
      expect(screen.getByText('Unsaved changes')).toBeTruthy()
      expect(meetingsApi.update).not.toHaveBeenCalled()
      await act(async () => { vi.advanceTimersByTime(1000) })
      await waitFor(() => expect(meetingsApi.update).toHaveBeenCalledWith(7, { body: 'new notes' }))
      expect(await screen.findByText('Saved')).toBeTruthy()
    })

    it('saves right away when the field loses focus', async () => {
      renderPage()
      await screen.findByLabelText('Meeting notes')
      fireEvent.change(notes(), { target: { value: 'quick' } })
      fireEvent.blur(notes())
      await waitFor(() => expect(meetingsApi.update).toHaveBeenCalledWith(7, { body: 'quick' }))
    })

    it('does not lose typing when you navigate away', async () => {
      const { unmount } = renderPage()
      await screen.findByLabelText('Meeting notes')
      fireEvent.change(notes(), { target: { value: 'typed just before leaving' } })
      unmount()
      await waitFor(() => expect(meetingsApi.update).toHaveBeenCalledWith(7, { body: 'typed just before leaving' }))
    })

    it('saves title, date, time and attendees as separate fields', async () => {
      renderPage()
      await screen.findByLabelText('Meeting title')
      fireEvent.change(screen.getByLabelText('Meeting title'), { target: { value: '  Renamed  ' } })
      fireEvent.change(screen.getByLabelText('Attendees'), { target: { value: 'Budi' } })
      fireEvent.change(screen.getByLabelText('Meeting date'), { target: { value: '2026-11-02' } })
      fireEvent.change(screen.getByLabelText('Meeting time'), { target: { value: '14:30' } })
      fireEvent.blur(screen.getByLabelText('Attendees'))
      await waitFor(() => expect(meetingsApi.update).toHaveBeenCalled())
      const patch = vi.mocked(meetingsApi.update).mock.calls[0][1]
      expect(patch.title).toBe('Renamed')
      expect(patch.attendees).toBe('Budi')
      expect(new Date(patch.held_at as string).getTime()).toBe(new Date('2026-11-02T14:30').getTime())
    })

    it('does not save an empty title and says why', async () => {
      renderPage()
      await screen.findByLabelText('Meeting title')
      fireEvent.change(screen.getByLabelText('Meeting title'), { target: { value: '   ' } })
      fireEvent.blur(screen.getByLabelText('Meeting title'))
      expect(screen.getByRole('alert').textContent).toBe('Title is required')
      expect(meetingsApi.update).not.toHaveBeenCalled()
    })

    it('shows the typed text and a retry when saving fails', async () => {
      vi.mocked(meetingsApi.update).mockRejectedValueOnce(new Error('offline'))
      const user = userEvent.setup()
      renderPage()
      await screen.findByLabelText('Meeting notes')
      fireEvent.change(notes(), { target: { value: 'kept on screen' } })
      fireEvent.blur(notes())
      expect(await screen.findByText(/Couldn't save/)).toBeTruthy()
      expect(notes().value).toBe('kept on screen')
      await user.click(screen.getByRole('button', { name: 'Retry' }))
      await waitFor(() => expect(vi.mocked(meetingsApi.update)).toHaveBeenLastCalledWith(7, { body: 'kept on screen' }))
      expect(await screen.findByText('Saved')).toBeTruthy()
    })
  })

  describe('process actions', () => {
    it('saves what is typed, lists the open lines, and creates only the ticked ones', async () => {
      const user = userEvent.setup()
      const after = 'after processing'
      vi.mocked(meetingsApi.process).mockResolvedValue({ created: [], meeting: meeting({ body: after, open_action_count: 1 }) })
      renderPage()
      await screen.findByLabelText('Meeting notes')
      fireEvent.change(notes(), { target: { value: BODY + '- [ ] typed last\n' } })

      await user.click(screen.getByRole('button', { name: 'Process actions' }))
      // the pending edit was saved before the lines were listed
      expect(meetingsApi.update).toHaveBeenCalledWith(7, { body: BODY + '- [ ] typed last\n' })
      const dialog = await screen.findByRole('dialog', { name: 'Process actions' })
      expect(within(dialog).getByText('Waiting · Budi')).toBeTruthy()

      await user.click(within(dialog).getByRole('checkbox', { name: 'Create task: send the logs' }))
      fireEvent.change(within(dialog).getByLabelText('Due date for: Send the report'), { target: { value: '2026-11-05' } })
      await user.selectOptions(within(dialog).getByLabelText('Priority for: Send the report'), 'high')
      await user.click(within(dialog).getByRole('button', { name: 'Create 1 task' }))

      await waitFor(() => expect(meetingsApi.process).toHaveBeenCalledWith(7, [
        { line: 1, text: 'Send the report', due_date: '2026-11-05', priority: 'high' },
      ]))
      await waitFor(() => expect(notes().value).toBe(after))
      expect(screen.queryByRole('dialog', { name: 'Process actions' })).toBeNull()
      expect(notify.success).toHaveBeenCalledWith('Created 0 tasks')
    })

    it('has the Create button off when every line is unticked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByLabelText('Meeting notes')
      await user.click(screen.getByRole('button', { name: 'Process actions' }))
      const dialog = await screen.findByRole('dialog', { name: 'Process actions' })
      for (const box of within(dialog).getAllByRole('checkbox')) await user.click(box)
      expect((within(dialog).getByRole('button', { name: 'Create 0 tasks' }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('keeps the dialog open and tells the user when the notes changed underneath', async () => {
      const user = userEvent.setup()
      vi.mocked(meetingsApi.process).mockRejectedValue(new Error('The meeting notes changed since the actions were listed.'))
      renderPage()
      await screen.findByLabelText('Meeting notes')
      await user.click(screen.getByRole('button', { name: 'Process actions' }))
      const dialog = await screen.findByRole('dialog', { name: 'Process actions' })
      await user.click(within(dialog).getByRole('button', { name: 'Create 2 tasks' }))
      await waitFor(() => expect(notify.error).toHaveBeenCalledWith("Couldn't create the tasks.", expect.stringContaining('notes changed')))
      expect(screen.getByRole('dialog', { name: 'Process actions' })).toBeTruthy()
    })

    it('is off when there are no open action lines', async () => {
      vi.mocked(meetingsApi.actions).mockResolvedValue({ ...ACTIONS, actions: [] })
      renderPage()
      await screen.findByLabelText('Meeting notes')
      await waitFor(() => expect(screen.getByText('No open action lines.')).toBeTruthy())
      expect((screen.getByRole('button', { name: 'Process actions' }) as HTMLButtonElement).disabled).toBe(true)
    })
  })

  it('deletes after confirmation and returns to the project', async () => {
    const user = userEvent.setup()
    vi.mocked(meetingsApi.delete).mockResolvedValue(undefined as never)
    renderPage()
    await screen.findByLabelText('Meeting notes')
    await user.click(screen.getByRole('button', { name: 'Delete meeting' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(meetingsApi.delete).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Delete meeting' }))
    await waitFor(() => expect(meetingsApi.delete).toHaveBeenCalledWith(7))
    expect(await screen.findByText('Project page')).toBeTruthy()
    expect(notify.success).toHaveBeenCalledWith('Meeting deleted', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }))
  })

  it('undo from the toast restores the meeting', async () => {
    const user = userEvent.setup()
    vi.mocked(meetingsApi.delete).mockResolvedValue(undefined as never)
    vi.mocked(meetingsApi.restore).mockResolvedValue(meeting())
    renderPage()
    await screen.findByLabelText('Meeting notes')
    await user.click(screen.getByRole('button', { name: 'Delete meeting' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete meeting' }))
    await waitFor(() => expect(notify.success).toHaveBeenCalled())
    const options = vi.mocked(notify.success).mock.calls[0][1] as { action: { onClick: () => void } }
    options.action.onClick()
    await waitFor(() => expect(meetingsApi.restore).toHaveBeenCalledWith(7))
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Meeting restored'))
  })

  it('is read-only for a meeting of an archived item', async () => {
    vi.mocked(meetingsApi.get).mockResolvedValue(meeting({ item_archived: true }))
    renderPage()
    await screen.findByLabelText('Meeting notes')
    expect(screen.getByText(/is archived, so its meetings are read-only/)).toBeTruthy()
    expect(notes().disabled).toBe(true)
    expect((screen.getByLabelText('Meeting title') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Delete meeting' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Process actions' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(notes(), { target: { value: 'x' } })
    fireEvent.blur(notes())
    expect(meetingsApi.update).not.toHaveBeenCalled()
  })
})
