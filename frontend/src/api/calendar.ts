import { apiClient } from './client'
import type { CalendarWeek } from '../types/models'

export const calendarApi = {
  week: (start: string, today: string, tzOffset?: string) =>
    apiClient.get<CalendarWeek>('/calendar/week', {
      params: { start, today, ...(tzOffset ? { tz_offset: tzOffset } : {}) },
    }).then(r => r.data),
}
