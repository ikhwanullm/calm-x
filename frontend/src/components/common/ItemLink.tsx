import { Link } from 'react-router-dom'
import type { ItemType } from '@/types/models'
import { cn } from '@/lib/utils'

interface ItemLinkProps {
  /** The Project or Area a task belongs to; null means the Inbox, which has no page */
  itemId: number | null
  itemType: ItemType | null
  /** Shown text; defaults to "Inbox" for a task without an item */
  title: string | null
  className?: string
}

const BASE_PATH: Record<ItemType, string> = {
  project: '/projects',
  area: '/areas',
  resource: '/resources',
}

/** The name of the Project or Area a task belongs to, as a link to its page. Plain text for the Inbox. */
export function ItemLink({ itemId, itemType, title, className }: ItemLinkProps) {
  const label = title ?? 'Inbox'
  if (itemId === null || itemType === null) {
    return <span className={className}>{label}</span>
  }
  return (
    <Link
      to={`${BASE_PATH[itemType]}/${itemId}`}
      className={cn('hover:text-accent-text hover:underline', className)}
    >
      {label}
    </Link>
  )
}
