import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30 seconds before refetch
      retry: 1,                     // retry once on failure
      refetchOnWindowFocus: false,  // local app — no need to refetch on focus
    },
    mutations: {
      retry: 0, // never retry mutations
    },
  },
})
