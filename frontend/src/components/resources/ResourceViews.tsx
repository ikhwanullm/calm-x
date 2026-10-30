import { Link, useNavigate } from 'react-router-dom'
import { CardLink } from '@/components/common'
import { daysSinceIso, formatRelativeDate, isoToLocalDateStr } from '@/utils/date'
import { RESOURCE_STALE_DAYS } from '@/utils/areaResourceList'
import { cn } from '@/lib/utils'
import type { Resource } from '@/types/models'

const CHIP = 'inline-flex items-center h-5 px-1.5 rounded-pill text-xs'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function updatedLabel(r: Resource, today: string): { text: string; stale: boolean } {
  const days = daysSinceIso(r.updated_at, today)
  if (days >= RESOURCE_STALE_DAYS) return { text: `not updated for ${days} days`, stale: true }
  const when = formatRelativeDate(isoToLocalDateStr(r.updated_at), today)
  return { text: `updated ${when.charAt(0).toLowerCase()}${when.slice(1)}`, stale: false }
}

/** A Resource in the card view of the Resources page. */
export function ResourceCard({ resource, today }: { resource: Resource; today: string }) {
  const stats = resource.stats
  const updated = updatedLabel(resource, today)
  return (
    <CardLink to={`/resources/${resource.id}`}>
      <h2 className="text-sm font-semibold text-text truncate">{resource.title}</h2>
      {resource.description && <p className="text-xs text-muted mt-0.5 line-clamp-1">{resource.description}</p>}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {stats && (
          <>
            <span className={cn(CHIP, 'bg-surface-2 text-muted')}>{plural(stats.reference_link_count, 'link', 'links')}</span>
            <span className={cn(CHIP, stats.linked_item_count === 0 ? 'bg-warn-bg text-warn-fg' : 'bg-accent-soft text-accent-text')}>
              {stats.linked_item_count === 0 ? 'Not linked to anything' : `Used by ${plural(stats.linked_item_count, 'project or area', 'projects and areas')}`}
            </span>
          </>
        )}
        <span className={cn('text-xs', updated.stale ? 'text-warn-fg' : 'text-muted')}>{updated.text}</span>
      </div>
    </CardLink>
  )
}

/** One row per Resource (compact view). */
export function ResourceList({ resources, today }: { resources: Resource[]; today: string }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-left">
        <caption className="sr-only">Resources</caption>
        <thead>
          <tr className="text-xs font-semibold text-muted uppercase tracking-wide">
            {['Title', 'Description', 'Links', 'Linked to', 'Updated'].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => {
            const updated = updatedLabel(r, today)
            return (
              <tr key={r.id} onClick={() => navigate(`/resources/${r.id}`)} className="border-t border-border hover:bg-surface-2 cursor-pointer">
                <td className="px-3 py-2 max-w-[16rem]">
                  <Link to={`/resources/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-sm font-medium text-text hover:underline block truncate">
                    {r.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-muted max-w-[20rem] truncate">{r.description || '—'}</td>
                <td className="px-3 py-2 text-sm tabular-nums text-muted">{r.stats?.reference_link_count ?? ''}</td>
                <td className={cn('px-3 py-2 text-sm tabular-nums', r.stats?.linked_item_count === 0 ? 'text-warn-fg' : 'text-muted')}>
                  {r.stats?.linked_item_count ?? ''}
                </td>
                <td className={cn('px-3 py-2 text-sm whitespace-nowrap', updated.stale ? 'text-warn-fg' : 'text-muted')}>{updated.text}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
