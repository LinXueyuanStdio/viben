import Link from "next/link"
import { listMoments, listCommunityComments } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { FeedCard } from "@/components/content/feed-card"
import type { FeedCardData, PreloadedComment } from "@/components/content/feed-card"
import { mapRichMomentToFeedCard } from "@/lib/services/moment-mapper"

export async function HomeFeedSection() {
  const session = await getSession()
  let feedItems: FeedCardData[] = []
  let preloadedComments: Record<string, PreloadedComment[]> = {}

  try {
    const momentsResult = await listMoments({ feedType: "recommended", session, limit: 5 })
    feedItems = momentsResult.items.map((item) => mapRichMomentToFeedCard(item))

    // 服务端批量获取评论预览（并行请求，避免客户端 N 次 HTTP 调用）
    const momentsWithComments = feedItems.filter(
      (item) => item.actions.comments > 0 && item.actions.momentId
    )
    if (momentsWithComments.length > 0) {
      const results = await Promise.all(
        momentsWithComments.map((item) =>
          listCommunityComments({
            entityType: "moment",
            entityId: item.actions.momentId!,
            parentCommentId: null,
            limit: 1,
            session,
          }).then((r) => ({
            momentId: item.actions.momentId!,
            comments: r.comments as PreloadedComment[],
          })).catch(() => ({ momentId: item.actions.momentId!, comments: [] }))
        )
      )
      for (const { momentId, comments } of results) {
        if (comments.length > 0) preloadedComments[momentId] = comments
      }
    }
  } catch (error) {
    console.error("[Home] Failed to fetch moments:", error)
  }

  if (feedItems.length === 0) return null

  return (
    <div className="grid gap-2">
      {feedItems.map((feed, i) => (
        <Link key={i} href={feed.actions.shareUrl || `/moment/${feed.actions.momentId}`} className="block">
          <FeedCard
            data={feed}
            variant="preloaded"
            session={session ? { username: session.username, userSlug: session.userSlug, avatarUrl: session.avatarUrl } : null}
            inFeed
            preloadedComments={feed.actions.momentId ? preloadedComments[feed.actions.momentId] : undefined}
          />
        </Link>
      ))}
    </div>
  )
}
