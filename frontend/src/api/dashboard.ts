import { apiClient } from "./client"
import type { DashboardData } from "../types/dashboard"

export const dashboardApi = {
  get: (today: string, tzOffset?: string) =>
    apiClient
      .get<DashboardData>("/dashboard", { params: { today, ...(tzOffset ? { tz_offset: tzOffset } : {}) } })
      .then((r) => r.data),
}
