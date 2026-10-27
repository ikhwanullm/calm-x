import { useQuery, useQueryClient } from "@tanstack/react-query"
import { dashboardApi } from "../api/dashboard"
import { getLocalToday } from "../utils/date"

export const dashboardKeys = {
  all: ["dashboard"] as const,
  forToday: (today: string) => [...dashboardKeys.all, today] as const,
}

export function useDashboard() {
  const today = getLocalToday()
  return useQuery({
    queryKey: dashboardKeys.forToday(today),
    queryFn: () => dashboardApi.get(today),
    staleTime: 60 * 1000,
  })
}

export function useInvalidateDashboard() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: dashboardKeys.all })
}
