// Placeholder — implemented in task 9.6
interface InboxStepProps {
  onOrganized: () => void
  onCompleted: () => void
  onDeleted: () => void
}
export function InboxStep(_props: InboxStepProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-text tracking-tight">Process your Inbox</h1>
      <p className="text-muted mt-1">Give every captured task a home, finish it, or let it go.</p>
    </div>
  )
}
