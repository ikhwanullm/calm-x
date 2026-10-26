import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Kbd } from '@/components/common/Kbd'
import { PriorityChip } from '@/components/common/PriorityChip'
import { TagChip } from '@/components/common/TagChip'
import { Skeleton, SkeletonGroup } from '@/components/common/Skeleton'

const TODAY = '2026-10-29'

export default function DevComponentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  return (
    <main className="bg-bg min-h-screen p-8 text-text">
      <h1 className="text-2xl font-semibold mb-6">Component Gallery (DEV only)</h1>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Button</h2>
        <div className="flex gap-3 flex-wrap">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">StatusBadge</h2>
        <div className="flex gap-3 flex-wrap">
          <StatusBadge status="overdue" date="2026-10-27" today={TODAY} />
          <StatusBadge status="approaching" date="2026-11-01" today={TODAY} />
          <StatusBadge status="on-track" date="2026-12-01" today={TODAY} />
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">ProgressBar</h2>
        <div className="flex flex-col gap-3 max-w-sm">
          <ProgressBar completed={1} total={8} label="1/8 = 13%" />
          <ProgressBar completed={5} total={10} label="5/10 = 50%" />
          <ProgressBar completed={10} total={10} label="10/10 = 100%" />
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Chips &amp; Badges</h2>
        <div className="flex gap-3 flex-wrap items-center">
          <PriorityChip priority="high" />
          <PriorityChip priority="medium" />
          <PriorityChip priority="low" />
          <TagChip name="design" />
          <TagChip name="frontend" />
          <Kbd>Q</Kbd>
          <Kbd>Ctrl+K</Kbd>
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">Skeleton</h2>
        <SkeletonGroup label="Loading items">
          <Skeleton className="w-full h-4 mb-2" delay={0} />
          <Skeleton className="w-3/4 h-4 mb-2" delay={0} />
          <Skeleton className="w-1/2 h-4" delay={0} />
        </SkeletonGroup>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">EmptyState</h2>
        <div className="flex gap-4">
          <EmptyState title="No tasks" description="Add your first task." action={{ label: "Add task", onClick: () => {} }} />
          <EmptyState title="No projects" description="Create a project." dashedBorder />
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3">ConfirmDialog</h2>
        <Button variant="danger" onClick={() => setDialogOpen(true)}>Open destructive dialog</Button>
        <ConfirmDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Delete project" description="This cannot be undone." confirmLabel="Delete project" onConfirm={() => setDialogOpen(false)} />
      </section>
    </main>
  )
}
