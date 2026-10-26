import { cn } from '@/lib/utils'

export interface TagChipProps {
  name: string
  className?: string
}

export function TagChip({ name, className }: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center h-5 px-1.5',
        'rounded bg-surface-2 text-text',  // 4px radius = 'rounded' in Tailwind (4px)
        'text-xs font-medium',              // ~12px
        className
      )}
    >
      #{name}
    </span>
  )
}
