import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '@/hooks/useTemplates'
import {
  Card,
  EmptyState,
  ConfirmDialog,
  Skeleton,
  SkeletonGroup,
} from '@/components/common'
import { TemplateEditorDialog } from '@/components/templates/TemplateEditorDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Template } from '@/types/models'

export default function TemplatesPage() {
  const { data: templates, isLoading, isError } = useTemplates()
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()
  const deleteMutation = useDeleteTemplate()

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deleteDialogTemplate, setDeleteDialogTemplate] = useState<Template | null>(null)

  // Handle create
  async function handleCreate(title: string, description: string) {
    await createMutation.mutateAsync({ title, description })
    setShowCreateDialog(false)
  }

  // Handle edit
  async function handleUpdate(title: string, description: string) {
    if (!editingTemplate) return
    await updateMutation.mutateAsync({
      id: editingTemplate.id,
      payload: { title, description },
    })
    setEditingTemplate(null)
  }

  // Handle delete
  async function handleConfirmDelete() {
    if (!deleteDialogTemplate) return
    try {
      await deleteMutation.mutateAsync(deleteDialogTemplate.id)
      setDeleteDialogTemplate(null)
    } catch {
      // Error handled in hook
      setDeleteDialogTemplate(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={24} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-text">Templates</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          className={cn(
            'flex items-center gap-2 h-11 px-4 rounded-control',
            'bg-accent text-accent-fg text-sm font-medium',
            'hover:opacity-90'
          )}
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New template
        </button>
      </div>

      {isLoading ? (
        <SkeletonGroup label="Loading templates">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full mb-4" delay={0} />
          ))}
        </SkeletonGroup>
      ) : isError ? (
        <p className="text-sm text-danger-fg">
          Couldn&apos;t load templates. Check that the server is running and try again.
        </p>
      ) : templates && templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create templates to quickly start new projects with predefined tasks."
          action={{ label: 'New template', onClick: () => setShowCreateDialog(true) }}
          dashedBorder
        />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {templates?.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingTemplate(template)}
              onDelete={() => setDeleteDialogTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <TemplateEditorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        onSave={handleCreate}
        isPending={createMutation.isPending}
      />

      {/* Edit Template Dialog */}
      <TemplateEditorDialog
        open={editingTemplate !== null}
        onOpenChange={(open) => { if (!open) setEditingTemplate(null) }}
        mode="edit"
        initialTitle={editingTemplate?.title ?? ''}
        initialDescription={editingTemplate?.description ?? ''}
        onSave={handleUpdate}
        isPending={updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogTemplate !== null}
        onOpenChange={(open) => { if (!open) setDeleteDialogTemplate(null) }}
        title="Delete template"
        description={`This will permanently delete "${deleteDialogTemplate?.title ?? 'this template'}" and all its tasks.`}
        confirmLabel="Delete template"
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  )
}

interface TemplateCardProps {
  template: Template
  onEdit: () => void
  onDelete: () => void
}

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/templates/${template.id}`} className="flex-1 min-w-0 group">
          <h2 className="text-base font-semibold text-text truncate group-hover:text-accent-text">
            {template.title}
          </h2>
          {template.description && (
            <p className="text-sm text-muted mt-1 line-clamp-2">
              {template.description}
            </p>
          )}
          <p className="text-xs text-muted mt-3">
            {template.task_count} {template.task_count === 1 ? 'task' : 'tasks'}
          </p>
        </Link>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-control',
                'text-muted hover:text-text hover:bg-surface-2',
                'focus:outline-2 focus:outline-accent focus:outline-offset-2'
              )}
              aria-label={`Actions for ${template.title}`}
            >
              <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil size={14} strokeWidth={1.75} className="mr-2" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-danger-fg focus:text-danger-fg">
              <Trash2 size={14} strokeWidth={1.75} className="mr-2" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}
