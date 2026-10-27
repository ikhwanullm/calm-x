import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { BadgeStatus } from '@/components/common/StatusBadge'

export const DEFAULT_THRESHOLD = 3  // fallback used while settings are loading or unavailable

/**
 * Compute the deadline status badge for a project.
 *
 * @param deadline - YYYY-MM-DD date string
 * @param isComplete - true if the project/task is completed
 * @param threshold - number of days for "approaching" (default 3)
 * @param today - YYYY-MM-DD override for testing; defaults to system date
 */
export function getDeadlineStatus(
  deadline: string,
  isComplete: boolean,
  threshold: number = DEFAULT_THRESHOLD,
  today?: string,
): BadgeStatus | null {
  if (isComplete) return null

  const todayDate = today ? parseISO(today) : new Date()
  const deadlineDate = parseISO(deadline)
  const diff = differenceInCalendarDays(deadlineDate, todayDate)

  if (diff < 0) return 'overdue'
  if (diff <= threshold) return 'approaching'
  return 'on-track'
}
