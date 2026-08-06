"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

interface PrefetchInput {
  communityEntityId: string
  pageDbId: string
  pageUid: string
}

export function usePrefetchDrawerTabs({ communityEntityId, pageDbId, pageUid }: PrefetchInput) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const idleId = requestIdleCallback?.(() => {
      queryClient.prefetchQuery({
        queryKey: ["page-comments", communityEntityId, pageDbId],
        queryFn: () =>
          fetch(
            `/api/community/comments?entity_type=published_page&entity_id=${communityEntityId}&limit=20`
          ).then((r) => r.json()),
        staleTime: 60_000,
      })

      queryClient.prefetchQuery({
        queryKey: ["page-notes", pageUid],
        queryFn: () =>
          fetch(`/api/notes?entity_type=published_page&entity_id=${pageUid}`).then((r) => r.json()),
        staleTime: 120_000,
      })
    })

    return () => {
      if (idleId) cancelIdleCallback(idleId)
    }
  }, [communityEntityId, pageDbId, pageUid, queryClient])
}
