import { findItemIcon, isItemColor } from '@/utils/itemIcons'
import { cn } from '@/lib/utils'

export type ItemIconSize = 16 | 20 | 28

interface ItemIconProps {
  icon?: string | null
  color?: string | null
  /** The item's title: its first letter is the fallback when there is no icon */
  title: string
  size?: ItemIconSize
  className?: string
}

const BOX: Record<ItemIconSize, { box: string; glyph: number; text: string }> = {
  16: { box: 'h-4 w-4 rounded-[5px]', glyph: 11, text: 'text-[10px]' },
  20: { box: 'h-5 w-5 rounded-[6px]', glyph: 13, text: 'text-xs' },
  28: { box: 'h-7 w-7 rounded-[7px]', glyph: 17, text: 'text-sm' },
}

/** A rounded square in a soft tint with the item's icon, or its first letter. Decorative: the name next to it is the label. */
export function ItemIcon({ icon, color, title, size = 20, className }: ItemIconProps) {
  const tint = isItemColor(color) ? color : 'slate'
  const found = findItemIcon(icon)
  const { box, glyph, text } = BOX[size]
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center font-semibold', box, text, className)}
      style={{ backgroundColor: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` }}
    >
      {found ? <found.Icon size={glyph} strokeWidth={1.75} /> : (title.trim().charAt(0).toUpperCase() || '?')}
    </span>
  )
}
