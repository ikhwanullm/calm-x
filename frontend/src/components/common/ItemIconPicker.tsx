import { useMemo, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ItemIcon } from './ItemIcon'
import { ICON_GROUPS, ITEM_COLORS, isItemColor } from '@/utils/itemIcons'
import { cn } from '@/lib/utils'
import type { ItemColor } from '@/types/models'

const COLUMNS = 8

interface ItemIconPickerProps {
  title: string
  icon: string | null | undefined
  color: string | null | undefined
  /** Saves at once; an explicit null removes the value */
  onChange: (patch: { icon?: string | null; color?: ItemColor | null }) => void
  /** Archived items are read-only: the icon is shown but cannot be changed */
  disabled?: boolean
}

/** The icon next to the title as a button that opens a search box, the icon grid, five color swatches and "Remove icon". */
export function ItemIconPicker({ title, icon, color, onChange, disabled = false }: ItemIconPickerProps) {
  const [query, setQuery] = useState('')
  const grid = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ICON_GROUPS
      .map((g) => ({ ...g, icons: g.icons.filter((o) => !q || o.key.includes(q) || o.label.toLowerCase().includes(q)) }))
      .filter((g) => g.icons.length > 0)
  }, [query])

  if (disabled) return <ItemIcon icon={icon} color={color} title={title} size={28} />

  /** Arrow keys move through the grid; Enter or Space picks the focused icon (a plain button click). */
  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }
    const step = moves[event.key]
    if (step === undefined) return
    const buttons = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>('button[data-icon]') ?? [])
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    event.preventDefault()
    buttons[Math.min(buttons.length - 1, Math.max(0, at + step))]?.focus()
  }

  return (
    <Popover onOpenChange={(open) => { if (!open) setQuery('') }}>
      <PopoverTrigger
        aria-label="Change icon"
        className="rounded-[7px] hover:ring-2 hover:ring-border focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ItemIcon icon={icon} color={color} title={title} size={28} />
      </PopoverTrigger>
      <PopoverContent aria-label="Choose an icon">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              grid.current?.querySelector<HTMLButtonElement>('button[data-icon]')?.focus()
            }
          }}
          placeholder="Search icons"
          aria-label="Search icons"
          className="h-8 w-full rounded-control border border-border-strong bg-surface px-2 text-sm text-text"
        />
        <div ref={grid} onKeyDown={handleGridKeyDown} className="mt-2 max-h-56 overflow-y-auto" role="group" aria-label="Icons">
          {groups.length === 0 && <p className="py-4 text-center text-sm text-muted">No icon matches.</p>}
          {groups.map((g) => (
            <div key={g.name} className="mb-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.name}</p>
              <div className="grid grid-cols-8 gap-1">
                {g.icons.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    data-icon={key}
                    aria-label={label}
                    aria-pressed={icon === key}
                    title={label}
                    onClick={() => onChange({ icon: key })}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-control text-text hover:bg-surface-2',
                      icon === key && 'bg-accent-soft text-accent-text',
                    )}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-3" role="group" aria-label="Color">
          {ITEM_COLORS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={color === key}
              title={label}
              onClick={() => onChange({ color: key })}
              className={cn(
                'h-6 w-6 rounded-full border',
                isItemColor(color) && color === key ? 'ring-2 ring-accent ring-offset-2 ring-offset-popover' : '',
              )}
              style={{ backgroundColor: `var(--tint-${key}-bg)`, borderColor: `var(--tint-${key}-fg)` }}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange({ icon: null, color: null })}
            disabled={!icon && !color}
            className="ml-auto text-xs text-muted hover:text-text disabled:opacity-50"
          >
            Remove icon
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
