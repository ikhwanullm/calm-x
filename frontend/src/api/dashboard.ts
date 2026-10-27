import { apiClient } from "./client"
import type { DashboardData } from "../types/dashboard"

export const dashboardApi = {
  get: (today: string) =>
    apiClient.get<DashboardData>("/dashboard", { params: { today } }).then((r) => r.data),
}
