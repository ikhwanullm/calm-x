import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isProject } from '@/types/models'
import type { Item } from '@/types/models'
import {
  useUpdateItem,
  useCompleteProject,
  useReopenProject,
  useArchiveItem,
  useRestoreItem,
  useDeleteItem,
} from '@/hooks/useItems'
import { ConfirmDialog } from '@/components/common'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TypeConversionDialog } from '@/components/items/TypeConversionDialog'
import { formatAbsoluteDate } from '@/utils/date'
import { InlineTitle } from './InlineTitle'

interface ItemHeaderProps {
  item: Item
  archived: boolean
  /** Where to go after the item is archived or deleted, e.g. "/projects" */
  listPath: string
}

/**
 * Everything at the top of the page that acts on the item itself: the archived and ready-to-complete banners,
 * the inline title, Mark complete / Reopen, the "···" menu (convert, archive, delete or restore) and the dialogs those open.
 */
export function ItemHeader({ item, archived, listPath }: ItemHeaderProps) {
  const updateItem = useUpdateItem(item.id)
  const completeProject = useCompleteProject()
  const reopenProject = useReopenProject()
  const archiveItem = useArchiveItem()
  const restoreItem = useRestoreItem()
  const deleteItem = useDeleteItem()
  const navigate = useNavigate()

  const [showArchivePrompt, setShowArchivePrompt] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)

  // R1.6: Complete project -> prompt to archive
  const handleCompleteProject = () => {
    completeProject.mutate(item.id, {
      onSuccess: () => setShowArchivePrompt(true),
    })
  }

  const handleArchiveConfirm = () => {
    archiveItem.mutate(item.id, {
      onSuccess: () => navigate(listPath),
    })
  }

  const handleDeleteConfirm = () => {
    deleteItem.mutate(item.id, {
      onSuccess: () => navigate(listPath),
    })
  }

  // Ready-for-completion condition (R4.7)
  const isReadyForCompletion =
    isProject(item) &&
    item.task_count > 0 &&
    item.completed_task_count === item.task_count &&
    item.project_status === 'active' &&
    !archived

  return (
    <>
      {/* 2.17: Full archive banner */}
      {archived && (
        <div
          className="mb-4 px-4 py-3 rounded-control border border-warn-fg bg-warn-bg text-sm flex items-center justify-between gap-4"
          role="status"
        >
          <span className="text-warn-fg font-medium">
            Read-only · Archived on {formatAbsoluteDate(item.archived_at!)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => restoreItem.mutate(item.id)}
              className="text-sm font-medium text-warn-fg hover:underline"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-danger-fg hover:underline"
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}

      {/* 2.14: Ready-for-completion banner */}
      {isReadyForCompletion && (
        <div className="mb-4 px-4 py-3 rounded-control border border-ok-fg bg-ok-bg text-ok-fg text-sm flex items-center justify-between">
          <span>All tasks done. Ready to complete this project.</span>
          <button
            type="button"
            onClick={handleCompleteProject}
            className="text-sm font-medium underline hover:no-underline"
          >
            Complete project
          </button>
        </div>
      )}

      {/* Header row: title + 2.16 actions menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title - inline edit */}
          <InlineTitle
            item={item}
            disabled={archived}
            onSave={(title) => updateItem.mutate({ title })}
          />

          {/* 2.15: Mark complete / Reopen actions */}
          {isProject(item) && !archived && item.project_status === 'active' && (
            <button
              type="button"
              onClick={handleCompleteProject}
              className="block mt-5 text-sm text-accent-text hover:underline"
            >
              Mark project complete
            </button>
          )}
          {isProject(item) && !archived && item.project_status === 'completed' && (
            <button
              type="button"
              onClick={() => reopenProject.mutate(item.id)}
              className="block mt-5 text-sm text-muted hover:text-accent-text hover:underline"
            >
              Reopen project
            </button>
          )}
        </div>

        {/* 2.16: Item actions menu (...) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Item actions"
              className="flex-shrink-0 mt-1 p-1.5 rounded-control text-muted hover:text-text hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              <span aria-hidden="true" className="text-base leading-none tracking-widest">···</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {archived ? (
              <>
                <DropdownMenuItem onSelect={() => restoreItem.mutate(item.id)}>
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteConfirm(true)}
                  className="text-danger-fg focus:text-danger-fg"
                >
                  Delete permanently
                </DropdownMenuItem>
              </>
            ) : (
              <>
  <DropdownMenuItem onSelect={() => setShowConvertDialog(true)}>
                  Convert type
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    archiveItem.mutate(item.id, { onSuccess: () => navigate(listPath) })
                  }}
                >
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowDeleteConfirm(true)}
                  className="text-danger-fg focus:text-danger-fg"
                >
                  Delete {item.type}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 2.15: Archive prompt after completing project (R1.6) */}
      <ConfirmDialog
        open={showArchivePrompt}
        onOpenChange={setShowArchivePrompt}
        title="Archive this project?"
        description="The project has been marked complete. Would you like to archive it now?"
        confirmLabel="Archive"
        cancelLabel="Keep active"
        destructive={false}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setShowArchivePrompt(false)}
      />

      <TypeConversionDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        itemId={item.id}
        currentType={item.type}
      />


      {/* 2.16: Delete confirm dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}?`}
        description={`This will permanently delete "${item.title}" and all its tasks${item.type === 'resource' ? '' : ' and meeting notes'}. This cannot be undone.`}
        confirmLabel={`Delete ${item.type}`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
