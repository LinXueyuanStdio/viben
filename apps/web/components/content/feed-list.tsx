"use client"

import { useState, useCallback, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { FeedCard } from "./feed-card"
import type { FeedCardData } from "./feed-card"
import { Button } from "@/components/ui/button"
import { mapRichMomentToFeedCard } from "@/lib/services/moment-mapper"
import type { MomentFeedItem } from "@/lib/services/community"

interface FeedListProps {
  initialItems: FeedCardData[]
  initialHasMore: boolean
  initialCursor: string | null
  feedType: "latest" | "following" | "recommended"
  emptyMessage: React.ReactNode
}

async function fetchMore(feedType: string, cursor: string | null): Promise<{
  items: FeedCardData[]
  has_more: boolean
  next_cursor: string | null
}> {
  const params = new URLSearchParams({ feed_type: feedType, limit: "10" })
  if (cursor) params.set("cursor", cursor)
  const res = await fetch(`/api/moments?${params}`)
  if (!res.ok) throw new Error("fetch_failed")
  const data = await res.json()

  const items: FeedCardData[] = (data.items ?? []).map((item: unknown) =>
    mapRichMomentToFeedCard(item as MomentFeedItem),
  )

  return {
    items,
    has_more: data.has_more as boolean,
    next_cursor: data.next_cursor as string | null,
  }
}

export function FeedList({ initialItems, initialHasMore, initialCursor, feedType, emptyMessage }: FeedListProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<FeedCardData[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, startLoading] = useTransition()

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    startLoading(async () => {
      try {
        const result = await fetchMore(feedType, cursor)
        setItems((prev) => [...prev, ...result.items])
        setCursor(result.next_cursor)
        setHasMore(result.has_more)
      } catch {
        toast.error(t("community.loadFailed"))
      }
    })
  }, [feedType, cursor, hasMore, loading])

  if (items.length === 0) {
    return <>{emptyMessage}</>
  }

  return (
    <div className="grid gap-2">
      {items.map((feed, i) => (
        <FeedCard key={feed.actions.momentId ?? `feed-${i}`} data={feed} variant="rich" />
      ))}
      {hasMore && (
        <Button
          variant="outline"
          onClick={loadMore}
          disabled={loading}
          className="w-full min-h-[44px] text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin mr-1.5" />
              {t("community.loading")}
            </>
          ) : (
            t("community.loadMoreMoments")
          )}
        </Button>
      )}
    </div>
  )
}
