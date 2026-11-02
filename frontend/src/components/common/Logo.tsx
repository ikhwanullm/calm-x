interface LogoProps {
  /** Width and height in px */
  size?: number
  className?: string
}

/**
 * The Calm-X mark: a rounded square with an open "C" and a check inside. Colors come from the accent tokens,
 * so it follows dark mode. Decorative: the wordmark next to it carries the name.
 */
export function Logo({ size = 28, className }: LogoProps) {
  // A little heavier when small so the strokes stay readable
  const heavy = size < 20
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M21 10.5a8 8 0 1 0 0 11"
        stroke="var(--accent-fg)"
        strokeWidth={heavy ? 3.4 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 16l2.5 2.5L22 13"
        stroke="var(--accent-fg)"
        strokeWidth={heavy ? 3 : 2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
