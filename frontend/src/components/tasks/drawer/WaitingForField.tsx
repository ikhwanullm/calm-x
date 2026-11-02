import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatAbsoluteDate, formatRelativeDate, isoToLocalDateStr } from '@/utils/date'

export function WaitingForField({
  waitingFor,
  waitingSince,
  onSave,
}: {
  waitingFor: string | null
  waitingSince: string | null
  onSave: (value: string | null) => void
}) {
  const [value, setValue] = useState(waitingFor ?? '')

  function save() {
    const next = value.trim() || null
    if (next !== waitingFor) onSave(next)
  }

  return (
    <div className="flex items-start gap-3">
      <label htmlFor="task-waiting-for" className="w-20 pt-2 text-sm text-muted shrink-0">
        Waiting for
      </label>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <input
            id="task-waiting-for"
            type="text"
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setValue(waitingFor ?? '')
            }}
            placeholder="Person, team or event"
            className={cn(
              'flex-1 min-w-0 h-9 px-3 rounded-control border border-border bg-surface text-sm text-text',
              'placeholder:text-muted focus:outline-2 focus:outline-offset-2 focus:outline-accent'
            )}
          />
          {waitingFor && (
            <button
              type="button"
              onClick={() => { setValue(''); onSave(null) }}
              className="text-xs text-muted hover:text-text hover:underline shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        {waitingFor && waitingSince && (
          <p className="mt-1 text-xs text-muted">
            Waiting since {formatAbsoluteDate(isoToLocalDateStr(waitingSince))} ·{' '}
            {formatRelativeDate(isoToLocalDateStr(waitingSince))}
          </p>
        )}
      </div>
    </div>
  )
}
