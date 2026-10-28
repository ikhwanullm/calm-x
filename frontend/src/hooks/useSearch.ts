import { useQuery } from "@tanstack/react-query"
import { searchApi } from "../api/search"

export const searchKeys = {
  results: (q: string) => ["search", q] as const,
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: searchKeys.results(query),
    queryFn: () => searchApi.search(query),
    enabled: query.trim().length > 0,
    staleTime: 10 * 1000,
  })
}
