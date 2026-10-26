import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps {
  /** Width class, e.g. "w-full", "w-32" */
  className?: string
  /** Override delay in ms (default 200). Useful for testing. */
  delay?: number
}

/**
 * Loading placeholder — shown after 200ms delay to prevent flash for fast loads.
 * Use className to set width/height matching the content it replaces.
 */
export function Skeleton({ className, delay = 200 }: SkeletonProps) {
  const [visible, setVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay === 0) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  if (!visible) return null

  return (
    <div
      className={cn(
        'animate-pulse rounded bg-surface-2',
        className
      )}
      role="status"
      aria-label="Loading"
      aria-busy="true"
    />
  )
}
