/**
 * Calculate progress percentage using integer rounding.
 *
 * Formula: Math.round((completed / total) * 100)
 * Special case for 1/8: (200*1 + 8) / (2*8) = 208/16 = 13  <- per task 1.15 regression
 *
 * The formula used is: floor((200 * completed + total) / (2 * total))
 * This ensures 1/8 = 13 (not 12), matching the banker's rounding expectation.
 *
 * Returns 0 when total === 0.
 */
export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.floor((200 * completed + total) / (2 * total))
}
