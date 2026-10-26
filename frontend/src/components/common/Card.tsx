import { HTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/utils'

const baseClasses =
  'bg-surface border border-border rounded-card shadow-card p-5'

// --- Static (non-clickable) card ---
export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn(baseClasses, className)} {...props}>
      {children}
    </div>
  )
}

// --- Clickable card (uses Link, not div onClick) ---
export interface CardLinkProps extends LinkProps {
  className?: string
}

export function CardLink({ className, children, ...props }: CardLinkProps) {
  return (
    <Link
      className={cn(
        baseClasses,
        'block cursor-pointer hover:border-accent transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
