import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ItemPicker } from '@/components/common/ItemPicker'
import type { Item, Task, TaskPriority } from '@/types/models'

export type EditKind = 'due' | 'waiting' | 'tag'

const FIELD =
  'h-8 px-2 text-sm rounded-control border border-border-strong bg-surface text-text focus:outline-2 focus:outline-offset-2 focus:outline-accent'
const SMALL_BUTTON =
  'h-8 px-3 rounded-control border border-border bg-surface text-sm font-medium text-text hover:bg-surface-2 disabled:opacity-50'

const EDIT_TEXT: Record<EditKind, { label: string; placeholder: string; save: string }> = {
  due: { label: 'Due date', placeholder: '', save: 'Set date' },
  waiting: { label: 'Waiting for', placeholder: 'Who or what? e.g. Budi', save: 'Set waiting' },
  tag: { label: 'Tag', placeholder: 'tag name', save: 'Add tag' },
}

/** A small form for one value: a date, a name, or a tag. Enter saves, Escape cancels. */
export function InlineEdit({
  kind, onSave, onCancel,
}: { kind: EditKind; onSave: (value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const text = EDIT_TEXT[kind]
  const valid = value.trim().length > 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (valid) onSave(value.trim())
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        type={kind === 'due' ? 'date' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        placeholder={text.placeholder}
        maxLength={kind === 'due' ? undefined : kind === 'tag' ? 50 : 200}
        aria-label={text.label}
        autoFocus
        className={cn(FIELD, kind !== 'due' && 'w-52')}
      />
      <button type="submit" disabled={!valid} className={SMALL_BUTTON}>{text.save}</button>
      <button type="button" onClick={onCancel} className="h-8 px-2 text-sm text-muted hover:text-text">Cancel</button>
    </form>
  )
}

/** The "⋯" menu of one Inbox row. */
export function RowMenu({
  task, onToday, onEdit, onSomeday, onDelete,
}: {
  task: Task
  onToday: () => void
  onEdit: (kind: EditKind) => void
  onSomeday: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for "${task.title}"`}
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-control text-muted hover:text-text hover:bg-surface-2"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onToday}>Add to Today</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit('due')}>Set due date…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit('waiting')}>Waiting for…</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSomeday}>Move to Someday</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-danger-fg focus:text-danger-fg">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface BulkBarProps {
  count: number
  destinations: Item[]
  onMove: (itemId: number) => void
  onPriority: (priority: TaskPriority) => void
  onToday: () => void
  onSomeday: () => void
  onDelete: () => void
  onEditValue: (kind: EditKind, value: string) => void
  onClear: () => void
}

/** What can be done to all selected Inbox tasks at once. */
export function BulkBar({
  count, destinations, onMove, onPriority, onToday, onSomeday, onDelete, onEditValue, onClear,
}: BulkBarProps) {
  const [editing, setEditing] = useState<EditKind | null>(null)

  return (
    <div role="region" aria-label="Selected tasks" className="mt-3 flex flex-col gap-2 px-3 py-2 rounded-control bg-accent-soft border border-accent">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-accent-text">
          {count} {count === 1 ? 'task' : 'tasks'} selected
        </span>
        {destinations.length > 0 && (
          <ItemPicker
            items={destinations}
            onSelect={(id) => { if (id !== null) onMove(id) }}
            placeholder="Move to…"
            ariaLabel="Move selected tasks to"
            variant="bar"
          />
        )}
        <select
          defaultValue=""
          onChange={(e) => { if (e.target.value) { onPriority(e.target.value as TaskPriority); e.target.value = '' } }}
          aria-label="Set priority of selected tasks"
          className={cn(FIELD, 'border-accent')}
        >
          <option value="" disabled>Priority…</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button type="button" onClick={onToday} className={SMALL_BUTTON}>Today</button>
        <button type="button" onClick={() => setEditing('due')} className={SMALL_BUTTON}>Due date…</button>
        <button type="button" onClick={() => setEditing('waiting')} className={SMALL_BUTTON}>Waiting for…</button>
        <button type="button" onClick={() => setEditing('tag')} className={SMALL_BUTTON}>Add tag…</button>
        <button type="button" onClick={onSomeday} className={SMALL_BUTTON}>Someday</button>
        <button type="button" onClick={onDelete} className={cn(SMALL_BUTTON, 'text-danger-fg hover:bg-danger-bg')}>Delete</button>
        <button type="button" onClick={onClear} className="ml-auto text-xs text-muted hover:text-text">
          Clear selection
        </button>
      </div>
      {editing && (
        <InlineEdit
          key={editing}
          kind={editing}
          onSave={(value) => { onEditValue(editing, value); setEditing(null) }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}
