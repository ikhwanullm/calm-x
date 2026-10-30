import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useCaptureSubmit, useCaptureTargets } from '@/hooks/useCapture'
import { parseCaptureText } from '@/utils/capture'
import { getLocalToday } from '@/utils/date'
import { notify } from '@/lib/toast'
import type { Task } from '@/types/models'

const MAX_LINES = 50
const PREVIEW_LINES = 8

export interface CaptureBoxProps {
  /** Accessible name of the text box */
  inputLabel: string
  submitLabel?: string
  submitAriaLabel?: string
  autoFocus?: boolean
  /** Called with the tasks that were created, after the toast */
  onAdded?: (created: Task[]) => void
  /** Called for Escape inside the box */
  onEscape?: () => void
  /** Replaces the default "Added to Inbox" toast */
  notifyAdded?: (created: Task[]) => void
  className?: string
}

/** "Added to Inbox", "Added 3 tasks to Migrate CML" or "Added 3 tasks", depending on where they went. */
export function describeAdded(created: Task[]): string {
  const where = new Set(created.map((t) => t.item_title ?? 'Inbox'))
  const count = created.length === 1 ? 'Added' : `Added ${created.length} tasks`
  return where.size === 1 ? `${count} to ${[...where][0]}` : count
}

const SYNTAX_HINT = 'Tip: besok !high #tag @project. Paste a list to add several.'

/**
 * Capture box: one line is one task. "Call vendor besok !high #work @CML" sets the due date, priority, tag and
 * project; several lines (or a pasted list) add several tasks. A preview shows how each line was read before it is saved.
 */
export function CaptureBox({
  inputLabel, submitLabel = 'Add', submitAriaLabel, autoFocus, onAdded, onEscape, notifyAdded, className,
}: CaptureBoxProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const hintId = useId()
  const targets = useCaptureTargets()
  const submit = useCaptureSubmit()
  const today = getLocalToday()

  const lines = useMemo(() => parseCaptureText(text, targets, today), [text, targets, today])
  const over = lines.length > MAX_LINES
  const usable = lines.slice(0, MAX_LINES)
  // Show the preview when something was read from the text, or when there is more than one line
  const interesting = usable.some((l) => l.due_date || l.priority || l.tags.length || l.target || l.unmatched.length)
  const showPreview = usable.length > 1 || interesting

  // Grow with the text, up to a few lines
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  async function handleSubmit() {
    if (busy || usable.length === 0) return
    setBusy(true)
    const { created, failed } = await submit(usable)
    setBusy(false)
    if (created.length > 0) {
      if (notifyAdded) notifyAdded(created)
      else notify.success(describeAdded(created))
      onAdded?.(created)
    }
    if (failed.length > 0) {
      // Keep what could not be added so it can be fixed and tried again
      setText(failed.map((f) => usable[f.index].source).join('\n'))
      notify.error(`${failed.length} of ${usable.length} could not be added.`, failed[0].message)
    } else {
      setText('')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSubmit()
    } else if (e.key === 'Escape') {
      onEscape?.()
    }
  }

  const label = usable.length > 1 ? `${submitLabel} ${usable.length} tasks` : submitLabel

  return (
    <div className={className}>
      <div className="flex gap-2 items-start">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Capture a task…"
          aria-label={inputLabel}
          aria-describedby={hintId}
          className={cn(
            'flex-1 min-h-11 px-4 py-2.5 rounded-control border border-border bg-surface resize-none',
            'text-sm text-text placeholder:text-muted',
            'focus:outline-2 focus:outline-offset-2 focus:outline-accent'
          )}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={usable.length === 0 || busy}
          aria-label={usable.length > 1 ? label : submitAriaLabel ?? submitLabel}
          className={cn(
            'h-11 px-4 rounded-control bg-accent text-accent-fg text-sm font-medium shrink-0',
            'hover:opacity-90 disabled:opacity-50 transition-opacity'
          )}
        >
          {busy ? 'Adding…' : label}
        </button>
      </div>

      <p id={hintId} className="mt-1.5 text-xs text-muted">{SYNTAX_HINT}</p>

      {over && (
        <p role="alert" className="mt-1 text-xs text-danger-fg">
          Only the first {MAX_LINES} lines are added at once. Add the rest afterwards.
        </p>
      )}

      {showPreview && (
        <ul aria-label="How the lines are read" className="mt-2 space-y-1">
          {usable.slice(0, PREVIEW_LINES).map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-text break-all">{l.title}</span>
              {l.due_date && <Chip>due {format(parseISO(l.due_date), 'EEE d MMM')}</Chip>}
              {l.priority && <Chip>{l.priority}</Chip>}
              {l.tags.map((t) => <Chip key={t}>#{t}</Chip>)}
              {l.target && <Chip accent>→ {l.target.title}</Chip>}
              {l.unmatched.map((u) => <Chip key={u} warn>no project matches {u}</Chip>)}
            </li>
          ))}
          {usable.length > PREVIEW_LINES && (
            <li className="text-xs text-muted">+{usable.length - PREVIEW_LINES} more lines</li>
          )}
        </ul>
      )}
    </div>
  )
}

function Chip({ children, accent, warn }: { children: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center h-5 px-1.5 rounded-pill',
        warn ? 'bg-warn-bg text-warn-fg' : accent ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-muted'
      )}
    >
      {children}
    </span>
  )
}
