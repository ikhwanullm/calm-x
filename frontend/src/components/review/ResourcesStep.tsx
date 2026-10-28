// Placeholder — implemented in task 9.9
interface ResourcesStepProps {
  onArchived: () => void
}
export function ResourcesStep(_props: ResourcesStepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text tracking-tight">Tidy your resources</h1>
      <p className="text-muted mt-1">Least recently updated first. Archive what you no longer need close at hand.</p>
    </div>
  )
}
