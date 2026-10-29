import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'
import {
  useDeleteMeeting,
  useMeeting,
  useMeetingActions,
  useProcessMeeting,
  useUpdateMeeting,
} from '@/hooks/useMeetings'
import { useAutosave } from '@/hooks/useAutosave'
import { Button, ConfirmDialog, Skeleton } from '@/components/common'
import { MarkdownView } from '@/components/meetings/MarkdownView'
import { ProcessActionsDialog } from '@/components/meetings/ProcessActionsDialog'
import { cn } from '@/lib/utils'
import { joinLocalDateTime, splitLocalDateTime } from '@/utils/meeting'
import type { Meeting, MeetingUpdatePayload } from '@/types/models'

const STATUS_TEXT = {
  idle: '',
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  error: "Couldn't save. Your text is still here.",
} as const

const fieldClass = cn(
  'h-9 px-3 rounded-control border border-border bg-surface text-sm text-text',
  'focus:outline-2 focus:outline-offset-2 focus:outline-accent disabled:opacity-60'
)

function itemPath(m: Pick<Meeting, 'item_id' | 'item_type'>): string {
  return `/${m.item_type === 'area' ? 'areas' : 'projects'}/${m.item_id}`
}

export default function MeetingPage() {
  const { id } = useParams()
  const meetingId = Number(id)
  const { data: meeting, isLoading, isError } = useMeeting(meetingId)

  if (isLoading) {
    return <div className="max-w-5xl space-y-3"><Skeleton className="h-8 w-64" delay={0} /><Skeleton className="h-64 w-full" delay={0} /></div>
  }
  if (isError || !meeting) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-danger-fg">This meeting could not be found. It may have been deleted.</p>
        <Link to="/meetings" className="text-sm text-accent-text hover:underline">Back to meetings</Link>
      </div>
    )
  }
  // key: a different meeting starts with fresh drafts
  return <MeetingEditor key={meeting.id} meeting={meeting} />
}

function MeetingEditor({ meeting }: { meeting: Meeting }) {
  const navigate = useNavigate()
  const readOnly = meeting.item_archived
  const updateMeeting = useUpdateMeeting(meeting.id)
  const deleteMeeting = useDeleteMeeting()
  const processMeeting = useProcessMeeting(meeting.id)
  const { data: parsed, refetch: refetchActions } = useMeetingActions(meeting.id)

  // Drafts live here; server refetches never overwrite what is being typed.
  const initialWhen = splitLocalDateTime(meeting.held_at)
  const [title, setTitle] = useState(meeting.title)
  const [date, setDate] = useState(initialWhen.date)
  const [time, setTime] = useState(initialWhen.time)
  const [attendees, setAttendees] = useState(meeting.attendees)
  const [body, setBody] = useState(meeting.body)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [showProcess, setShowProcess] = useState(false)

  const autosave = useAutosave<MeetingUpdatePayload>((patch) => updateMeeting.mutateAsync(patch))
  const save = (patch: MeetingUpdatePayload) => { if (!readOnly) autosave.schedule(patch) }

  function handleTitle(value: string) {
    setTitle(value)
    if (!value.trim()) { setTitleError('Title is required'); return }
    setTitleError(null)
    save({ title: value.trim() })
  }

  function handleWhen(nextDate: string, nextTime: string) {
    setDate(nextDate)
    setTime(nextTime)
    const iso = joinLocalDateTime(nextDate, nextTime)
    if (iso) save({ held_at: iso })
  }

  async function handleOpenProcess() {
    // Everything typed must be on the server before it is parsed
    if (!(await autosave.flush())) return
    await refetchActions()
    setShowProcess(true)
  }

  function handleProcess(chosen: Parameters<typeof processMeeting.mutate>[0]) {
    processMeeting.mutate(chosen, {
      onSuccess: (result) => {
        setBody(result.meeting.body)
        setShowProcess(false)
      },
    })
  }

  async function handleDelete() {
    setShowDelete(false)
    await deleteMeeting.mutateAsync(meeting.id).then(() => navigate(itemPath(meeting)), () => undefined)
  }

  const openActions = parsed?.actions ?? []

  return (
    <div className="max-w-5xl">
      <Link to={itemPath(meeting)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft size={14} aria-hidden="true" />
        {meeting.item_title}
      </Link>

      {readOnly && (
        <p className="mt-3 text-sm text-muted border border-border rounded-control px-3 py-2" role="status">
          This {meeting.item_type} is archived, so its meetings are read-only.
        </p>
      )}

      <div className="mt-3 space-y-3">
        <div>
          <input
            value={title}
            onChange={(e) => handleTitle(e.target.value)}
            onBlur={() => { void autosave.flush() }}
            maxLength={200}
            disabled={readOnly}
            aria-label="Meeting title"
            aria-invalid={titleError ? true : undefined}
            className="w-full text-2xl font-semibold text-text bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none py-1"
            style={{ letterSpacing: '-0.02em' }}
          />
          {titleError && <p className="mt-1 text-xs text-danger-fg" role="alert">{titleError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => handleWhen(e.target.value, time)}
            onBlur={() => { void autosave.flush() }}
            disabled={readOnly}
            aria-label="Meeting date"
            className={fieldClass}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => handleWhen(date, e.target.value)}
            onBlur={() => { void autosave.flush() }}
            disabled={readOnly}
            aria-label="Meeting time"
            className={fieldClass}
          />
          <input
            value={attendees}
            onChange={(e) => { setAttendees(e.target.value); save({ attendees: e.target.value }) }}
            onBlur={() => { void autosave.flush() }}
            maxLength={500}
            disabled={readOnly}
            placeholder="Attendees (free text)"
            aria-label="Attendees"
            className={cn(fieldClass, 'flex-1 min-w-[12rem]')}
          />
          <span className="text-xs text-muted min-w-[8rem] text-right" role="status" aria-live="polite">
            {STATUS_TEXT[autosave.status]}
            {autosave.status === 'error' && (
              <button type="button" onClick={() => { void autosave.flush() }} className="ml-2 underline hover:text-text">
                Retry
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="flex items-center gap-1 mb-2" role="group" aria-label="Notes view">
            {(['edit', 'preview'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  'h-8 px-3 rounded-control text-sm font-medium',
                  view === v ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-text'
                )}
              >
                {v === 'edit' ? 'Edit' : 'Preview'}
              </button>
            ))}
          </div>

          {view === 'edit' ? (
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); save({ body: e.target.value }) }}
              onBlur={() => { void autosave.flush() }}
              disabled={readOnly}
              maxLength={50000}
              spellCheck
              aria-label="Meeting notes"
              placeholder="Write in Markdown. Start a line with [ ] for your action, @Name: for someone else's, ? for a question, ! for a decision."
              className={cn(
                'w-full min-h-[60vh] p-3 rounded-control border border-border bg-surface text-sm text-text font-mono leading-relaxed',
                'focus:outline-2 focus:outline-offset-2 focus:outline-accent placeholder:text-muted disabled:opacity-60'
              )}
            />
          ) : (
            <div className="min-h-[60vh] p-3 rounded-control border border-border bg-surface" aria-label="Notes preview">
              <MarkdownView source={body} />
            </div>
          )}
        </div>

        <aside className="space-y-4" aria-label="Found in your notes">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">
              Actions <span className="font-normal tabular-nums">{openActions.length || ''}</span>
            </h2>
            {openActions.length === 0 ? (
              <p className="text-sm text-muted">No open action lines.</p>
            ) : (
              <ul className="space-y-1 text-sm text-text">
                {openActions.map((a) => (
                  <li key={a.line}>
                    {a.kind === 'waiting' && <span className="text-xs text-muted">@{a.who} · </span>}
                    {a.text}
                  </li>
                ))}
              </ul>
            )}
            {(parsed?.converted ?? 0) > 0 && (
              <p className="text-xs text-muted">{parsed?.converted} already turned into tasks</p>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => { void handleOpenProcess() }}
              disabled={readOnly || openActions.length === 0}
            >
              Process actions
            </Button>
          </div>

          {(parsed?.decisions.length ?? 0) > 0 && (
            <div className="space-y-1">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Decisions</h2>
              <ul className="space-y-1 text-sm text-text list-disc pl-4">
                {parsed?.decisions.map((d) => <li key={d.line}>{d.text}</li>)}
              </ul>
            </div>
          )}

          {(parsed?.questions.length ?? 0) > 0 && (
            <div className="space-y-1">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Open questions</h2>
              <ul className="space-y-1 text-sm text-text list-disc pl-4">
                {parsed?.questions.map((q) => <li key={q.line}>{q.text}</li>)}
              </ul>
            </div>
          )}

          {!readOnly && (
            <Button type="button" variant="danger" size="sm" onClick={() => setShowDelete(true)} aria-label="Delete meeting">
              <Trash2 size={14} aria-hidden="true" />
              Delete meeting
            </Button>
          )}
        </aside>
      </div>

      <ProcessActionsDialog
        open={showProcess}
        onOpenChange={setShowProcess}
        actions={openActions}
        isPending={processMeeting.isPending}
        onConfirm={handleProcess}
      />

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete meeting"
        description="This meeting and its notes will be deleted. Tasks created from it stay. You can undo it from the message that appears."
        confirmLabel="Delete meeting"
        onConfirm={() => { void handleDelete() }}
        destructive
      />
    </div>
  )
}
