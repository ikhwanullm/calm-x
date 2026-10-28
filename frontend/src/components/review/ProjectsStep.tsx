// Placeholder — implemented in task 9.7
interface ProjectsStepProps {
  onCompleted: () => void
  onUpdatedDueDate: () => void
  onArchived: () => void
}
export function ProjectsStep(_props: ProjectsStepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text tracking-tight">Review active projects</h1>
      <p className="text-muted mt-1">Decide the next move for every open task.</p>
    </div>
  )
}
