"use client"

import { useState, useCallback, useTransition } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { FeedCard } from "./feed-card"
import type { FeedCardData } from "./feed-card"
import { Button } from "@/components/ui/button"

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

  // Map API response to FeedCardData (simplified — reuses server mapping)
  const items: FeedCardData[] = (data.items ?? []).map((item: Record<string, unknown>) => {
    const moment = (item.moment ?? {}) as Record<string, unknown>
    const author = (item.author ?? {}) as Record<string, unknown>
    const attachments = (item.attachments ?? []) as Array<Record<string, unknown>>
    const viewerState = (item.viewer_state ?? {}) as Record<string, boolean>

    const FEED_KIND_MAP: Record<string, "发布" | "更新" | "转发"> = {
      post: "发布", page_update: "更新", repost: "转发", system: "更新",
    }

    return {
      head: {
        fallbackText: (author.display_name as string)?.[0] ?? "?",
        avatarUrl: author.avatar_url as string | undefined,
        name: author.display_name as string,
        handle: `@${author.user_slug as string}`,
        userSlug: author.user_slug as string,
        kind: FEED_KIND_MAP[moment.kind as string] ?? "发布",
        timeAgo: "",
        source: moment.source as string | undefined,
      },
      text: (moment.body as string) ?? "",
      quote: moment.quote_text as string | undefined,
      attachment: attachments[0] ? {
        cover: (attachments[0].cover_url as string)
          ? `url(${attachments[0].cover_url})`
          : undefined,
        title: (attachments[0].title as string) ?? "",
        authorName: (attachments[0].author_name_snapshot as string) ?? "",
        timeAgo: "",
        stats: {
          views: (attachments[0].view_count_snapshot as number) ?? 0,
          comments: (attachments[0].comment_count_snapshot as number) ?? 0,
        },
      } : undefined,
      actions: {
        views: (moment.view_count as number) ?? 0,
        likes: (moment.like_count as number) ?? 0,
        comments: (moment.comment_count as number) ?? 0,
        reposts: (moment.repost_count as number) ?? 0,
        bookmarks: (moment.bookmark_count as number) ?? 0,
        momentId: moment.id as string,
        shareUrl: `/moment/${moment.id}`,
        hasLiked: viewerState.has_liked as boolean,
        hasBookmarked: viewerState.has_bookmarked as boolean,
      },
    }
  })

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
        // silently fail — user can retry
      }
    })
  }, [feedType, cursor, hasMore, loading])

  if (items.length === 0) {
    return <>{emptyMessage}</>
  }

  return (
    <div className="grid gap-2">
      {items.map((feed) => (
        <FeedCard key={feed.actions.momentId ?? crypto.randomUUID()} data={feed} variant="rich" />
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
