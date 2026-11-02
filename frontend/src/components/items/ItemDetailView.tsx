import { Link } from 'react-router-dom'
import { isProject, isArea, isArchived } from '@/types/models'
import { useItem, useUpdateItem } from '@/hooks/useItems'
import { ProgressBar, Skeleton, SkeletonGroup } from '@/components/common'
import { useDeadlineThreshold } from '@/hooks/useSettings'
import { getLocalToday } from '@/utils/date'
import { ReferenceLinksSection } from '@/components/items/ReferenceLinksSection'
import { ResourceLinksSection } from '@/components/items/ResourceLinksSection'
import { LinkedResourcesSection } from '@/components/items/LinkedResourcesSection'
import { ProjectAreaField } from '@/components/items/ProjectAreaField'
import { AreaProjectsSection } from '@/components/items/AreaProjectsSection'
import { MeetingsSection } from '@/components/meetings/MeetingsSection'
import { ItemSummary } from '@/components/items/ItemSummary'
import { InlineDeadline } from './detail/InlineDeadline'
import { InlineField } from './detail/InlineField'
import { ItemHeader } from './detail/ItemHeader'
import { TasksSection } from './detail/TasksSection'

interface ItemDetailViewProps {
  id: number
  /** Base path for breadcrumb link e.g. "/projects" */
  listPath: string
  listLabel: string
}

export function ItemDetailView({ id, listPath, listLabel }: ItemDetailViewProps) {
  const { data: item, isLoading, isError } = useItem(id)
  const threshold = useDeadlineThreshold()
  const updateItem = useUpdateItem(id)
  const today = getLocalToday()

  if (isLoading) {
    return (
      <SkeletonGroup label="Loading item details">
        <Skeleton className="w-48 h-6 mb-4" delay={0} />
        <Skeleton className="w-full h-8 mb-2" delay={0} />
        <Skeleton className="w-3/4 h-4" delay={0} />
      </SkeletonGroup>
    )
  }

  if (isError || !item) {
    return (
      <p className="text-sm text-danger-fg">
        Couldn&apos;t load item. Check the server is running and try again.
      </p>
    )
  }

  const archived = isArchived(item)

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm text-muted">
          <li><Link to={listPath} className="hover:text-accent-text">{listLabel}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-text font-medium" aria-current="page">{item.title}</li>
        </ol>
      </nav>

      {/* Banners, title, complete/reopen, the ··· menu and their dialogs */}
      <ItemHeader item={item} archived={archived} listPath={listPath} />

      {/* Project deadline — inline editable (R4.1, R4.2) */}
      {isProject(item) && (
        <InlineDeadline
          deadline={item.project_deadline}
          isComplete={item.project_status === 'completed'}
          disabled={archived}
          today={today}
          threshold={threshold}
          onSave={(v) => updateItem.mutate({ project_deadline: v || null })}
        />
      )}

      {/* Optional parent Area of a project */}
      {isProject(item) && (
        <ProjectAreaField
          project={item}
          disabled={archived}
          onChange={(areaId) => updateItem.mutate({ area_id: areaId })}
        />
      )}

      {/* Project goal */}
      {isProject(item) && (
        <InlineField
          label="Goal"
          value={item.project_goal ?? ''}
          placeholder="What does success look like?"
          disabled={archived}
          onSave={(v) => updateItem.mutate({ project_goal: v || null })}
        />
      )}

      {/* Project progress */}
      {isProject(item) && item.task_count > 0 && (
        <div className="mt-4">
          <ProgressBar
            completed={item.completed_task_count}
            total={item.task_count}
            label={`${item.title} progress`}
          />
        </div>
      )}

      {/* Open / overdue / waiting numbers, next task and meetings (Projects and Areas) */}
      {item.type !== 'resource' && item.stats && (
        <ItemSummary stats={item.stats} isArea={isArea(item)} today={today} />
      )}

      {/* Description */}
      <InlineField
        label="Description"
        value={item.description}
        placeholder="Add a description…"
        multiline
        disabled={archived}
        onSave={(v) => updateItem.mutate({ description: v })}
      />

      {/* Projects that belong to this Area */}
      {isArea(item) && <AreaProjectsSection areaId={item.id} isArchived={archived} />}

      {/* Tasks section — not shown for Resources (R3.7) */}
      {item.type !== 'resource' && (
        <TasksSection item={item} archived={archived} />
      )}

      {/* Meeting notes — Projects and Areas only */}
      {item.type !== 'resource' && (
        <MeetingsSection itemId={item.id} itemTitle={item.title} isArchived={archived} />
      )}

      {/* Area maintenance notes */}
      {isArea(item) && (
        <InlineField
          label="Maintenance notes"
          value={item.area_maintenance_notes ?? ''}
          placeholder="Notes on how to maintain this area…"
          multiline
          disabled={archived}
          onSave={(v) => updateItem.mutate({ area_maintenance_notes: v || null })}
        />
      )}

      {/* Notes */}
      <InlineField
        label="Notes"
        value={item.notes}
        placeholder="Add notes…"
        multiline
        disabled={archived}
        onSave={(v) => updateItem.mutate({ notes: v })}
      />

      {/* Reference links */}
      <ReferenceLinksSection itemId={item.id} isArchived={archived} />

      {/* Resource links: Resources list their Projects/Areas, Projects/Areas list their Resources */}
      {item.type === 'resource' ? (
        <ResourceLinksSection resourceId={item.id} isArchived={archived} />
      ) : (
        <LinkedResourcesSection itemId={item.id} isArchived={archived} />
      )}

    </div>
  )
}
