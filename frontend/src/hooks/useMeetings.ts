import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meetingsApi } from '../api/meetings'
import { itemKeys } from './useItems'
import { dashboardKeys } from './useDashboard'
import { taskKeys, UNDO_TOAST_MS } from './useTasks'
import { notify } from '../lib/toast'
import type {
  Meeting,
  MeetingCreatePayload,
  MeetingUpdatePayload,
  ProcessActionPayload,
} from '../types/models'

export const meetingKeys = {
  all: ['meetings'] as const,
  list: (q: string) => [...meetingKeys.all, 'list', q] as const,
  forItem: (itemId: number) => [...meetingKeys.all, 'item', itemId] as const,
  detail: (id: number) => [...meetingKeys.all, 'detail', id] as const,
  actions: (id: number) => [...meetingKeys.all, 'actions', id] as const,
}

/** All meetings, newest first; `q` searches title, attendees and notes. */
export function useMeetings(q = '') {
  return useQuery({ queryKey: meetingKeys.list(q), queryFn: () => meetingsApi.list(q.trim() || undefined) })
}

export function useItemMeetings(itemId: number) {
  return useQuery({
    queryKey: meetingKeys.forItem(itemId),
    queryFn: () => meetingsApi.listForItem(itemId),
    enabled: itemId > 0,
  })
}

export function useMeeting(id: number) {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => meetingsApi.get(id),
    enabled: id > 0,
  })
}

/** Action lines, questions and decisions as the server parses them from the saved notes. */
export function useMeetingActions(id: number) {
  return useQuery({
    queryKey: meetingKeys.actions(id),
    queryFn: () => meetingsApi.actions(id),
    enabled: id > 0,
  })
}

export function useCreateMeeting(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MeetingCreatePayload) => meetingsApi.create(itemId, payload),
    onSuccess: (meeting) => {
      qc.setQueryData(meetingKeys.detail(meeting.id), meeting)
      qc.invalidateQueries({ queryKey: meetingKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
    onError: (err: Error) => notify.error("Couldn't create the meeting. Try again.", err.message),
  })
}

/** Saves edits silently (autosave); the page shows the Saving/Saved state itself. */
export function useUpdateMeeting(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MeetingUpdatePayload) => meetingsApi.update(id, payload),
    onSuccess: (meeting) => {
      qc.setQueryData(meetingKeys.detail(id), meeting)
      qc.invalidateQueries({ queryKey: meetingKeys.actions(id) })
      qc.invalidateQueries({ queryKey: [...meetingKeys.all, 'list'] })
      qc.invalidateQueries({ queryKey: [...meetingKeys.all, 'item'] })
    },
  })
}

export function useDeleteMeeting() {
  const qc = useQueryClient()

  function refreshAll() {
    qc.invalidateQueries({ queryKey: meetingKeys.all })
    qc.invalidateQueries({ queryKey: taskKeys.all })
    qc.invalidateQueries({ queryKey: itemKeys.all })
  }

  async function undo(id: number) {
    try {
      await meetingsApi.restore(id)
      refreshAll()
      notify.success('Meeting restored')
    } catch (err) {
      notify.error("Couldn't restore the meeting.", (err as Error).message)
    }
  }

  return useMutation({
    mutationFn: (id: number) => meetingsApi.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: meetingKeys.detail(id) })
      qc.removeQueries({ queryKey: meetingKeys.actions(id) })
      refreshAll()
      notify.success('Meeting deleted', {
        action: { label: 'Undo', onClick: () => { void undo(id) } },
        duration: UNDO_TOAST_MS,
      })
    },
    onError: (err: Error) => notify.error("Couldn't delete the meeting. Try again.", err.message),
  })
}

export function useProcessMeeting(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (actions: ProcessActionPayload[]) => meetingsApi.process(id, actions),
    onSuccess: (result) => {
      qc.setQueryData<Meeting>(meetingKeys.detail(id), result.meeting)
      qc.invalidateQueries({ queryKey: meetingKeys.all })
      qc.invalidateQueries({ queryKey: taskKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
      const n = result.created.length
      notify.success(`Created ${n} ${n === 1 ? 'task' : 'tasks'}`)
    },
    onError: (err: Error) => notify.error("Couldn't create the tasks.", err.message),
  })
}
