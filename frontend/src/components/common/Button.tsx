import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'default' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Set true when an icon-only button; requires aria-label on the element. */
  iconOnly?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:opacity-90 focus-visible:outline-accent',
  secondary:
    'bg-surface text-text border border-border hover:bg-surface-2',
  ghost:
    'bg-transparent text-accent-text hover:bg-surface-2',
  danger:
    'bg-transparent text-danger-fg hover:bg-danger-bg',
}

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'default',
      iconOnly = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base
          'inline-flex items-center justify-center gap-2',
          'rounded-control font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variant + size
          variantClasses[variant],
          sizeClasses[size],
          // Icon-only: square, no horizontal padding
          iconOnly && 'px-0 w-11 data-[size=sm]:w-9',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
