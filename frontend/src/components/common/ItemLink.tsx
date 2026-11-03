import { Link } from 'react-router-dom'
import type { ItemType } from '@/types/models'
import { cn } from '@/lib/utils'
import { ItemIcon } from './ItemIcon'

interface ItemLinkProps {
  /** The Project or Area a task belongs to; null means the Inbox, which has no page */
  itemId: number | null
  itemType: ItemType | null
  /** Shown text; defaults to "Inbox" for a task without an item */
  title: string | null
  /** The item's icon and tint, shown as a 16 px square before the name (a letter when there is no icon) */
  icon?: string | null
  color?: string | null
  className?: string
}

const BASE_PATH: Record<ItemType, string> = {
  project: '/projects',
  area: '/areas',
  resource: '/resources',
}

/** The name of the Project or Area a task belongs to, as a link to its page. Plain text for the Inbox. */
export function ItemLink({ itemId, itemType, title, icon, color, className }: ItemLinkProps) {
  const label = title ?? 'Inbox'
  if (itemId === null || itemType === null) {
    return <span className={className}>{label}</span>
  }
  return (
    <Link
      to={`${BASE_PATH[itemType]}/${itemId}`}
      className={cn('hover:text-accent-text hover:underline', itemType !== 'resource' && 'inline-flex items-center gap-1.5', className)}
    >
      {itemType !== 'resource' && <ItemIcon icon={icon} color={color} title={label} size={16} />}
      {label}
    </Link>
  )
}
