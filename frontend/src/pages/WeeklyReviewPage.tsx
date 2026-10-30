import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLocalToday } from '@/utils/date'
import { useShortcuts } from '@/hooks/useShortcuts'
import { QuickCaptureDialog } from '@/components/capture/QuickCaptureDialog'
import { CommandPalette } from '@/components/search/CommandPalette'
import { ShortcutHelp } from '@/components/search/ShortcutHelp'
import { useReviewStatus, useCompleteReview } from '@/hooks/useReview'
import { InboxStep } from '@/components/review/InboxStep'
import { MeetingsStep } from '@/components/review/MeetingsStep'
import { WaitingStep } from '@/components/review/WaitingStep'
import { SomedayStep } from '@/components/review/SomedayStep'
import { ProjectsStep } from '@/components/review/ProjectsStep'
import { AreasStep } from '@/components/review/AreasStep'
import { ResourcesStep } from '@/components/review/ResourcesStep'
import { SummaryStep } from '@/components/review/SummaryStep'
import { ReviewComplete } from '@/components/review/ReviewComplete'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewStepId = 'inbox' | 'meetings' | 'waiting' | 'projects' | 'areas' | 'resources' | 'someday' | 'summary'

export const REVIEW_STEPS: { id: ReviewStepId; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'waiting', label: 'Waiting for' },
  { id: 'projects', label: 'Projects' },
  { id: 'areas', label: 'Areas' },
  { id: 'resources', label: 'Resources' },
  { id: 'someday', label: 'Someday' },
  { id: 'summary', label: 'Summary' },
]

export interface ActionCounts {
  organizedInbox: number  // moved to project/area
  completed: number
  updatedDueDates: number
  archived: number
  followedUp: number      // waiting tasks followed up, received or released
  startedIdeas: number    // Someday ideas started
  droppedIdeas: number    // Someday ideas dropped
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WeeklyReviewPage() {
  const navigate = useNavigate()
  const today = getLocalToday()

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [actionCounts, setActionCounts] = useState<ActionCounts>({
    organizedInbox: 0,
    completed: 0,
    updatedDueDates: 0,
    archived: 0,
    followedUp: 0,
    startedIdeas: 0,
    droppedIdeas: 0,
  })
  const [notes, setNotes] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [completedAt, setCompletedAt] = useState<string | null>(null)

  // Overlay states (Quick capture, command palette, shortcut help)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const { data: reviewStatus } = useReviewStatus()
  const completeReviewMutation = useCompleteReview()

  // Global shortcuts (same as AppShell) — fire only outside inputs/dialogs
  useShortcuts({
    Q: () => !paletteOpen && !helpOpen && setCaptureOpen(true),
    '/': () => { setCaptureOpen(false); setPaletteOpen(true) },
    '?': () => { setCaptureOpen(false); setPaletteOpen(false); setHelpOpen(true) },
    'ctrl+k': () => { setCaptureOpen(false); setPaletteOpen(true) },
    Escape: () => { setCaptureOpen(false); setPaletteOpen(false); setHelpOpen(false) },
    // Review navigation shortcut
    ArrowRight: () => { if (!isCompleted && !isSummary) goNext() },
  })

  // Action count helpers
  function incrementCount(key: keyof ActionCounts, amount = 1) {
    setActionCounts(prev => ({ ...prev, [key]: prev[key] + amount }))
  }

  // Step navigation
  const currentStep = REVIEW_STEPS[currentStepIdx]
  const isFirst = currentStepIdx === 0
  const isSummary = currentStepIdx === REVIEW_STEPS.length - 1

  function goNext() {
    if (!isSummary) setCurrentStepIdx(i => i + 1)
  }
  function goBack() {
    if (!isFirst) setCurrentStepIdx(i => i - 1)
  }

  // Complete the review
  async function handleCompleteReview() {
    const record = await completeReviewMutation.mutateAsync(notes)
    setCompletedAt(record.completed_at)
    setIsCompleted(true)
  }

  // Last review sub-line
  const lastReviewText = reviewStatus?.last_review_days_ago != null
    ? ` · Last completed ${reviewStatus.last_review_days_ago === 0 ? 'today' : `${reviewStatus.last_review_days_ago} day${reviewStatus.last_review_days_ago === 1 ? '' : 's'} ago`}`
    : ''

  return (
    <div
      className="flex flex-col min-h-screen bg-bg"
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 px-8 py-3.5 bg-surface border-b border-border shrink-0">
        {/* Logo + title */}
        <div className="flex flex-col">
          <span className="font-semibold text-[15px] text-text leading-tight">Weekly review</span>
          <span className="text-xs text-muted">
            Started{' '}
            <time dateTime={today} title={today}>today</time>
            {lastReviewText}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        <span className="text-xs text-muted max-w-xs hidden sm:block">
          Changes save as you go. The review is recorded when you finish Summary.
        </span>

        <button
          type="button"
          onClick={() => navigate('/')}
          className={cn(
            'inline-flex items-center gap-1.5 h-11 px-4 rounded-control',
            'border border-border bg-surface text-text text-sm font-semibold',
            'hover:bg-surface-2'
          )}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
          Exit review
        </button>
      </header>

      {/* Step nav */}
      <nav aria-label="Review steps" className="px-8 py-5 bg-surface border-b border-border shrink-0">
        <ol className="flex flex-wrap items-center gap-2 mx-auto max-w-[1160px]" style={{ padding: 0, listStyle: 'none', margin: '0 auto' }}>
          {REVIEW_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIdx
            const isCurrent = idx === currentStepIdx
            const isLast = idx === REVIEW_STEPS.length - 1
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className="flex items-center gap-2 flex-1"
                style={{ minWidth: 0 }}
              >
                {/* Step circle */}
                <span
                  className={cn(
                    'w-7 h-7 shrink-0 rounded-full inline-flex items-center justify-center text-[13px] font-semibold border',
                    isDone && 'bg-accent text-accent-fg border-accent',
                    isCurrent && 'bg-accent-soft text-accent-text border-accent',
                    !isDone && !isCurrent && 'bg-surface text-muted border-border'
                  )}
                >
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 4.5 4.5L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                {/* Label */}
                <span className={cn(
                  'text-sm whitespace-nowrap font-medium',
                  isCurrent ? 'text-accent-text' : isDone ? 'text-text' : 'text-muted'
                )}>
                  {step.label}
                </span>
                {/* Connector line */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn('flex-1 h-0.5 min-w-4 rounded-full', isDone ? 'bg-accent' : 'bg-border')}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Main content */}
      <main className="flex-1 w-full max-w-[820px] mx-auto px-8 py-8 pb-6 flex flex-col gap-5" id="review-main">
        {isCompleted ? (
          <ReviewComplete completedAt={completedAt} />
        ) : (
          <>
            {currentStep.id === 'inbox' && (
              <InboxStep
                onOrganized={() => incrementCount('organizedInbox')}
                onCompleted={() => incrementCount('completed')}
                onDeleted={() => {}}
              />
            )}
            {currentStep.id === 'meetings' && <MeetingsStep />}
            {currentStep.id === 'waiting' && <WaitingStep onHandled={() => incrementCount('followedUp')} />}
            {currentStep.id === 'projects' && (
              <ProjectsStep
                onCompleted={() => incrementCount('completed')}
                onUpdatedDueDate={() => incrementCount('updatedDueDates')}
                onArchived={() => incrementCount('archived')}
              />
            )}
            {currentStep.id === 'areas' && (
              <AreasStep
                onTaskAdded={() => {}}
              />
            )}
            {currentStep.id === 'resources' && (
              <ResourcesStep
                onArchived={() => incrementCount('archived')}
              />
            )}
            {currentStep.id === 'someday' && (
              <SomedayStep
                onActivated={() => incrementCount('startedIdeas')}
                onDropped={() => incrementCount('droppedIdeas')}
              />
            )}
            {currentStep.id === 'summary' && (
              <SummaryStep
                actionCounts={actionCounts}
                notes={notes}
                onNotesChange={setNotes}
              />
            )}
          </>
        )}
      </main>

      {/* Sticky footer */}
      {!isCompleted && (
        <footer className="sticky bottom-0 flex justify-center px-8 py-4 bg-surface border-t border-border shrink-0">
          <div className="w-full max-w-[756px] flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={isFirst}
              className={cn(
                'h-11 px-4 rounded-control border border-border bg-surface text-text text-sm font-semibold',
                'disabled:opacity-40 hover:bg-surface-2'
              )}
            >
              Back
            </button>
            <div className="flex-1" />
            {isSummary ? (
              <button
                type="button"
                onClick={handleCompleteReview}
                disabled={completeReviewMutation.isPending}
                className="h-11 px-5 rounded-control bg-accent text-accent-fg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {completeReviewMutation.isPending ? 'Saving…' : 'Complete review'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="h-11 px-5 rounded-control bg-accent text-accent-fg text-sm font-semibold hover:opacity-90"
              >
                {REVIEW_STEPS[currentStepIdx + 1]?.label} →
              </button>
            )}
          </div>
        </footer>
      )}

      {/* Overlays — Q / Ctrl+K / ? still work in review */}
      <QuickCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onQuickCapture={() => { setPaletteOpen(false); setCaptureOpen(true) }}
        onNewProject={() => { setPaletteOpen(false) }}
      />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} reviewMode />
    </div>
  )
}
