import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Item } from '@/types/models'

const RECENT_KEY = 'calmx.recentDestinations'
const MAX_RECENT = 5

function readRecent(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function rememberRecent(id: number) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((n) => n !== id)].slice(0, MAX_RECENT)))
  } catch { /* remembering is optional */ }
}

type Destination = Extract<Item, { type: 'project' | 'area' }>

const isDestination = (item: Item): item is Destination => item.type === 'project' || item.type === 'area'

/** Title first when it starts with the search, then the rest by title. */
function matches(items: Destination[], query: string): Destination[] {
  const q = query.trim().toLowerCase()
  const haystack = (i: Destination) => `${i.title} ${i.type === 'project' ? i.area_title ?? '' : ''}`.toLowerCase()
  const found = q ? items.filter((i) => haystack(i).includes(q)) : items
  return [...found].sort((a, b) => {
    const rank = (i: Destination) => (q && i.title.toLowerCase().startsWith(q) ? 0 : 1)
    return rank(a) - rank(b) || a.title.localeCompare(b.title)
  })
}

export interface ItemPickerProps {
  /** Projects and areas to choose from (anything else is ignored) */
  items: Item[]
  /** Currently chosen id; null with `allowInbox` means the Inbox */
  value?: number | null
  /** The chosen id, or null for "Inbox" when `allowInbox` is on */
  onSelect: (id: number | null) => void
  placeholder: string
  ariaLabel: string
  allowInbox?: boolean
  variant?: 'row' | 'bar' | 'field'
  /** Which side of the button the list lines up with */
  align?: 'left' | 'right'
  disabled?: boolean
  className?: string
}

const TRIGGER: Record<NonNullable<ItemPickerProps['variant']>, string> = {
  row: 'h-7 px-2 text-xs border-border bg-surface text-muted hover:text-text hover:border-accent',
  bar: 'h-8 px-2 text-sm border-accent bg-surface text-text',
  field: 'h-11 px-2.5 text-sm border-border bg-bg text-text w-full justify-between',
}

/**
 * Choose a project or area from a list that can be long: type to narrow it down (the title or the name of the
 * project's area), pick with the arrow keys and Enter, and the destinations used last are listed first.
 */
export function ItemPicker({
  items, value, onSelect, placeholder, ariaLabel, allowInbox = false, variant = 'field', align = 'left', disabled, className,
}: ItemPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [up, setUp] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const destinations = useMemo(() => items.filter(isDestination), [items])
  const selected = destinations.find((d) => d.id === value) ?? null
  const results = useMemo(() => matches(destinations, query), [destinations, query])
  const recent = useMemo(
    () => (open && !query.trim() ? readRecent().flatMap((id) => destinations.find((d) => d.id === id) ?? []).slice(0, MAX_RECENT) : []),
    [open, query, destinations]
  )

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    // Open upwards when there is more room above than below
    const rect = trigger.current?.getBoundingClientRect()
    if (rect) {
      const below = window.innerHeight - rect.bottom
      setUp(below < 320 && rect.top > below)
      // The list is 20rem wide: line it up with the right edge when there is no room to the right
      setAlignRight(align === 'right' || rect.left + 320 > window.innerWidth)
    }
    setQuery('')
    setOpen(true)
  }

  function choose(id: number | null) {
    if (id !== null) rememberRecent(id)
    setOpen(false)
    trigger.current?.focus()
    onSelect(id)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
  }

  const label = selected ? selected.title : value === null && allowInbox ? 'Inbox' : placeholder
  const row = (d: Destination, prefix: string) => (
    <Command.Item
      key={`${prefix}-${d.id}`}
      value={`${prefix}-${d.id}`}
      onSelect={() => choose(d.id)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-text cursor-pointer data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-text"
    >
      <span className="text-xs text-muted w-12 shrink-0">{d.type === 'project' ? 'Project' : 'Area'}</span>
      <span className="flex-1 min-w-0 truncate">{d.title}</span>
      {d.type === 'project' && d.area_title && <span className="text-xs text-muted truncate max-w-[7rem]">{d.area_title}</span>}
    </Command.Item>
  )

  return (
    <div ref={root} className={cn('relative', variant === 'field' ? 'block' : 'shrink-0 inline-block', className)} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-control border max-w-[16rem]',
          'focus:outline-2 focus:outline-offset-2 focus:outline-accent disabled:opacity-50',
          TRIGGER[variant]
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} aria-hidden="true" className="shrink-0" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-40 w-80 max-w-[90vw] rounded-control border border-border bg-surface shadow-lg overflow-hidden',
            alignRight ? 'right-0' : 'left-0',
            up ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          <Command shouldFilter={false} label={ariaLabel}>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              autoFocus
              placeholder="Search projects and areas…"
              aria-label="Search projects and areas"
              className="w-full h-10 px-3 text-sm bg-surface text-text border-b border-border outline-none placeholder:text-muted"
            />
            <Command.List id={listId} className="max-h-64 overflow-y-auto py-1" aria-label={ariaLabel}>
              {allowInbox && !query.trim() && (
                <Command.Item
                  value="inbox"
                  onSelect={() => choose(null)}
                  className="px-3 py-2 text-sm text-text cursor-pointer data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-text"
                >
                  Inbox
                </Command.Item>
              )}
              {recent.length > 0 && (
                <Command.Group heading="Recent" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
                  {recent.map((d) => row(d, 'recent'))}
                </Command.Group>
              )}
              <Command.Group
                heading={query.trim() ? `${results.length} found` : 'All'}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted"
              >
                {results.map((d) => row(d, 'item'))}
              </Command.Group>
              {results.length === 0 && <p className="px-3 py-3 text-sm text-muted">Nothing matches &quot;{query.trim()}&quot;.</p>}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  )
}
