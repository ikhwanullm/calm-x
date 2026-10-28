// Placeholder — implemented in task 9.8
interface AreasStepProps {
  onTaskAdded: () => void
}
export function AreasStep(_props: AreasStepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text tracking-tight">Check your areas</h1>
      <p className="text-muted mt-1">Is every area of responsibility being maintained?</p>
    </div>
  )
}
