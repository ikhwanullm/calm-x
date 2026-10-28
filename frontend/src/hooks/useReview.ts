import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewApi } from '../api/review'
import { notify } from '../lib/toast'
import { dashboardKeys } from './useDashboard'
import { getLocalToday, getLocalTzOffset } from '../utils/date'

export * from '../api/review'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const reviewKeys = {
  all: ['weekly-review'] as const,
  status: (today: string) => [...reviewKeys.all, 'status', today] as const,
  inbox: () => [...reviewKeys.all, 'inbox'] as const,
  projects: (today: string) => [...reviewKeys.all, 'projects', today] as const,
  areas: (today: string) => [...reviewKeys.all, 'areas', today] as const,
  resources: (today: string) => [...reviewKeys.all, 'resources', today] as const,
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useReviewStatus() {
  const today = getLocalToday()
  return useQuery({
    queryKey: reviewKeys.status(today),
    queryFn: () => reviewApi.getStatus(today),
  })
}

export function useReviewInbox() {
  return useQuery({
    queryKey: reviewKeys.inbox(),
    queryFn: () => reviewApi.getInbox(),
    staleTime: 0,  // always fresh in review context
  })
}

export function useReviewProjects() {
  const today = getLocalToday()
  const tzOffset = getLocalTzOffset()
  return useQuery({
    queryKey: reviewKeys.projects(today),
    queryFn: () => reviewApi.getProjects(today, tzOffset),
    staleTime: 0,
  })
}

export function useReviewAreas() {
  const today = getLocalToday()
  const tzOffset = getLocalTzOffset()
  return useQuery({
    queryKey: reviewKeys.areas(today),
    queryFn: () => reviewApi.getAreas(today, tzOffset),
    staleTime: 0,
  })
}

export function useReviewResources() {
  const today = getLocalToday()
  const tzOffset = getLocalTzOffset()
  return useQuery({
    queryKey: reviewKeys.resources(today),
    queryFn: () => reviewApi.getResources(today, tzOffset),
    staleTime: 0,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCompleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notes: string) => reviewApi.complete({ notes }),
    onSuccess: () => {
      // Invalidate dashboard so last_review_date updates
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
      // Invalidate review status
      qc.invalidateQueries({ queryKey: reviewKeys.all })
    },
    onError: (err: Error) => {
      notify.error("Couldn't save the review. Check that the server is running.", err.message)
    },
  })
}
