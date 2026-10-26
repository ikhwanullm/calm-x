import React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps {
  /** Tailwind width/height classes */
  className?: string
  /** Delay in ms before placeholder becomes visible (default 200) */
  delay?: number
}

/**
 * Single skeleton placeholder.
 * - Reserves space immediately (no layout shift) using visibility:hidden.
 * - Becomes visible after `delay` ms (default 200ms).
 * - No role="status" -- wrap multiple Skeletons in a SkeletonGroup.
 */
export function Skeleton({ className, delay = 200 }: SkeletonProps) {
  const [visible, setVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay === 0) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(
        'animate-pulse rounded bg-surface-2',
        !visible && 'invisible',
        className
      )}
    />
  )
}

export interface SkeletonGroupProps {
  /** Accessible loading label */
  label?: string
  children: React.ReactNode
}

/**
 * Wraps one or more Skeletons with a single role="status" landmark.
 * Use this whenever you render skeletons as a loading state.
 */
export function SkeletonGroup({ label = 'Loading', children }: SkeletonGroupProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      {children}
    </div>
  )
}
