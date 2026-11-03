import { useEffect, useState } from 'react'

const REFRESH_MS = 5 * 60 * 1000

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** The greeting for the local hour. It is worked out again when the window regains focus and every 5 minutes. */
export function useGreeting(): string {
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()))

  useEffect(() => {
    const refresh = () => setGreeting(greetingForHour(new Date().getHours()))
    const timer = window.setInterval(refresh, REFRESH_MS)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return greeting
}
