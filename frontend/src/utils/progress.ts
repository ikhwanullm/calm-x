/**
 * Calculate progress percentage using round-half-up (integer math).
 *
 * Formula: floor((200 * completed + total) / (2 * total))
 * This is round-half-up, NOT Math.round (which is round-half-to-even / banker's rounding).
 * Example: 1/8 = 12.5 -> rounds UP to 13.
 *
 * Returns 0 when total <= 0.
 */
export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.floor((200 * completed + total) / (2 * total))
}
