import { createContext, useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Flag, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { dayOfMonth, isWeekend, meetingTime, weekdayShort } from '@/utils/week'
import type { CalendarDay, Task } from '@/types/models'

const MAX_PER_DAY = 4

type Entry =
  | { key: string; kind: 'meeting'; label: string; time: string; itemTitle: string | null; to: string }
  | { key: string; kind: 'due' | 'planned' | 'starts'; label: string; task: Task; overdue: boolean }
  | { key: string; kind: 'deadline'; label: string; to: string }

/** True while a task is being dragged: tooltips stay closed so they cannot cover the drop targets. */
const DraggingContext = createContext(false)

const KIND_LABEL = { due: 'Due', planned: 'Planned for today', starts: 'Starts', deadline: 'Project deadline' } as const

/** Everything of one day in the order the design asks for: meetings, due, planned, deadlines, starts. */
export function dayEntries(day: CalendarDay, today: string): Entry[] {
  const overdue = day.date < today
  const task = (kind: 'due' | 'planned' | 'starts', t: Task): Entry => ({
    key: `${kind}-${t.id}`, kind, label: t.title, task: t, overdue: kind === 'due' && overdue,
  })
  return [
    ...day.meetings.map((m): Entry => ({
      key: `meeting-${m.id}`, kind: 'meeting', label: m.title, time: meetingTime(m.held_at), itemTitle: m.item_title, to: `/meetings/${m.id}`,
    })),
    ...day.due.map((t) => task('due', t)),
    ...day.planned.map((t) => task('planned', t)),
    ...day.deadlines.map((d): Entry => ({ key: `deadline-${d.id}`, kind: 'deadline', label: d.title, to: `/projects/${d.id}` })),
    ...day.starts.map((t) => task('starts', t)),
  ]
}

const TINT: Record<string, string> = {
  meeting: 'bg-accent-soft text-accent-text',
  due: 'bg-warn-bg text-warn-fg',
  overdue: 'bg-danger-bg text-danger-fg',
  planned: 'bg-surface-2 text-text',
  deadline: 'border border-border bg-surface text-warn-fg',
  starts: 'bg-surface-2 text-muted',
}

const CHIP = 'flex items-start gap-1 w-full min-h-7 px-2 py-1 rounded-control text-xs text-left'

/** What the chip shows: the meeting time on a line of its own, then the title on up to two lines. */
function ChipText({ label, time }: { label: string; time?: string }) {
  return (
    <span className="min-w-0 flex-1">
      {time && <span className="block text-[11px] leading-4 tabular-nums opacity-80">{time}</span>}
      <span className="line-clamp-2 break-words">{label}</span>
    </span>
  )
}

/** The full title and what the entry is, shown on hover and keyboard focus. */
function EntryTooltip({ entry, children }: { entry: Entry; children: React.ReactElement }) {
  const dragging = useContext(DraggingContext)
  const kind = entry.kind === 'meeting' ? `Meeting ${entry.time}` : KIND_LABEL[entry.kind]
  const where = entry.kind === 'meeting' ? entry.itemTitle : 'task' in entry ? entry.task.item_title : null
  const waitingFor = 'task' in entry ? entry.task.waiting_for : null
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {!dragging && (
        <TooltipContent>
          <p className="font-medium text-text break-words">{entry.label}</p>
          <p className="text-muted">{kind}</p>
          {where && <p className="text-muted break-words">{where}</p>}
          {waitingFor && <p className="text-muted break-words">Waiting for {waitingFor}</p>}
        </TooltipContent>
      )}
    </Tooltip>
  )
}

function TaskEntry({ entry, onOpenTask }: { entry: Extract<Entry, { task: Task }>; onOpenTask: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.key, data: { task: entry.task },
  })
  const tint = TINT[entry.overdue ? 'overdue' : entry.kind]
  return (
    <EntryTooltip entry={entry}>
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpenTask(entry.task.id)}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(CHIP, tint, 'cursor-grab touch-none', isDragging && 'relative z-10 shadow-md opacity-90')}
      {...attributes}
      {...listeners}
    >
      {entry.kind === 'starts' && <Play size={10} aria-hidden="true" className="shrink-0 mt-1" />}
      <ChipText label={entry.label} />
    </button>
    </EntryTooltip>
  )
}

function DayColumn({
  day, today, isSelected, onSelectDay, onOpenTask,
}: {
  day: CalendarDay; today: string; isSelected: boolean
  onSelectDay: (date: string) => void; onOpenTask: (id: number) => void
}) {
  const isPast = day.date < today
  const { setNodeRef, isOver } = useDroppable({ id: day.date, disabled: isPast })
  const entries = dayEntries(day, today)
  const shown = entries.slice(0, MAX_PER_DAY)
  const hidden = entries.length - shown.length
  return (
    <li
      ref={setNodeRef}
      aria-label={`${weekdayShort(day.date)} ${dayOfMonth(day.date)}`}
      data-date={day.date}
      className={cn(
        'flex flex-col gap-1 min-w-0 min-h-28 p-2 rounded-xl border bg-surface',
        isWeekend(day.date) && 'bg-surface-2/60',
        day.date === today ? 'border-accent' : 'border-border',
        isSelected && 'ring-2 ring-accent/40',
        isOver && 'ring-2 ring-accent'
      )}
    >
      <button
        type="button"
        onClick={() => onSelectDay(day.date)}
        aria-pressed={isSelected}
        className={cn(
          'flex items-baseline gap-1.5 text-left rounded-control hover:text-text',
          isWeekend(day.date) ? 'text-muted' : 'text-text'
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">{weekdayShort(day.date)}</span>
        <span className={cn('text-sm tabular-nums', day.date === today && 'font-semibold text-accent-text')}>{dayOfMonth(day.date)}</span>
      </button>
      {shown.map((entry) =>
        'task' in entry ? (
          <TaskEntry key={entry.key} entry={entry} onOpenTask={onOpenTask} />
        ) : (
          <EntryTooltip key={entry.key} entry={entry}>
            <Link to={entry.to} className={cn(CHIP, TINT[entry.kind])}>
              {entry.kind === 'deadline' && <Flag size={10} aria-hidden="true" className="shrink-0 mt-1" />}
              <ChipText label={entry.label} time={entry.kind === 'meeting' ? entry.time : undefined} />
            </Link>
          </EntryTooltip>
        )
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => onSelectDay(day.date)} className="text-xs text-muted text-left px-2 hover:text-text">
          +{hidden} more
        </button>
      )}
    </li>
  )
}

export interface WeekStripProps {
  days: CalendarDay[]
  today: string
  selectedDay: string
  onSelectDay: (date: string) => void
  onOpenTask: (taskId: number) => void
  /** A task was dropped on another day that is not in the past. */
  onMoveTask: (task: Task, toDate: string) => void
}

/** Seven day columns (a vertical agenda below 768 px). Tasks can be dragged to another day. */
export function WeekStrip({ days, today, selectedDay, onSelectDay, onOpenTask, onMoveTask }: WeekStripProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dragging, setDragging] = useState(false)

  function handleDragEnd(event: DragEndEvent) {
    setDragging(false)
    const task = event.active.data.current?.task as Task | undefined
    const target = event.over?.id
    if (!task || typeof target !== 'string' || target < today) return
    if (days.some((d) => d.date === target && d.due.some((t) => t.id === task.id))) return  // already due that day
    onMoveTask(task, target)
  }

  return (
    <DndContext sensors={sensors} onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd} onDragCancel={() => setDragging(false)}>
      <DraggingContext.Provider value={dragging}>
      <TooltipProvider delayDuration={300} skipDelayDuration={0}>
      <ol aria-label="Week" className="grid grid-cols-1 md:grid-cols-[repeat(7,minmax(0,1fr))] gap-2 list-none p-0 m-0">
        {days.map((day) => (
          <DayColumn
            key={day.date}
            day={day}
            today={today}
            isSelected={day.date === selectedDay}
            onSelectDay={onSelectDay}
            onOpenTask={onOpenTask}
          />
        ))}
      </ol>
      </TooltipProvider>
      </DraggingContext.Provider>
    </DndContext>
  )
}
