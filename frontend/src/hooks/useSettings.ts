import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'
import { DEFAULT_THRESHOLD } from '../utils/deadline'

export const settingsKeys = {
  all: ['settings'] as const,
}

/**
 * Fetches all user preferences from GET /api/settings.
 * Stale time 5 min so it does not re-fetch on every component mount.
 */
export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => settingsApi.get(),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Returns the approaching-deadline threshold (number of days).
 * Falls back to DEFAULT_THRESHOLD while settings are loading or unavailable.
 */
export function useDeadlineThreshold(): number {
  const { data } = useSettings()
  if (!data?.approaching_deadline_threshold) return DEFAULT_THRESHOLD
  const parsed = parseInt(data.approaching_deadline_threshold, 10)
  return isNaN(parsed) ? DEFAULT_THRESHOLD : parsed
}
