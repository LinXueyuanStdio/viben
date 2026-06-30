import { listMoments } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { FeedCard } from "@/components/content/feed-card"
import type { FeedCardData } from "@/components/content/feed-card"

function gradientCover(title: string): string {
  const hue = title.charCodeAt(0) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

const FEED_KIND_MAP: Record<string, "更新" | "发布" | "转发" | "评论" | "收藏" | "模板" | "数据" | "合集" | "论文" | "笔记"> = {
  post: "发布",
  page_update: "更新",
  repost: "转发",
  system: "更新",
}

export async function HomeFeedSection() {
  const session = await getSession()
  let feedItems: FeedCardData[] = []

  try {
    const momentsResult = await listMoments({ feedType: "recommended", session, limit: 5 })
    feedItems = momentsResult.items.map((item) => ({
      head: {
        fallbackText: item.author.display_name?.[0] ?? "?",
        avatarUrl: item.author.avatar_url ?? undefined,
        name: item.author.display_name ?? "?",
        handle: `@${item.author.user_slug}`,
        userSlug: item.author.user_slug,
        kind: FEED_KIND_MAP[item.moment.kind] ?? "发布",
        timeAgo: timeAgo(item.moment.created_at),
        source: item.moment.source ?? undefined,
      },
      text: item.moment.body ?? "",
      attachment: item.attachments?.[0] ? {
        cover: item.attachments[0].cover_url
          ? `url(${item.attachments[0].cover_url})`
          : gradientCover(item.attachments[0].title ?? ""),
        title: item.attachments[0].title ?? "",
        authorName: item.attachments[0].author_name_snapshot ?? "",
        timeAgo: "",
        stats: {
          views: item.attachments[0].view_count_snapshot ?? 0,
          comments: item.attachments[0].comment_count_snapshot ?? 0,
        },
      } : undefined,
      actions: {
        views: item.moment.view_count ?? 0,
        likes: item.moment.like_count,
        comments: item.moment.comment_count,
        bookmarks: item.moment.bookmark_count ?? 0,
        momentId: item.moment.id,
        shareUrl: `/moment/${item.moment.id}`,
        hasLiked: item.viewer_state.has_liked,
        hasBookmarked: item.viewer_state.has_bookmarked,
      },
    }))
  } catch (error) {
    console.error("[Home] Failed to fetch moments:", error)
  }

  if (feedItems.length === 0) return null

  return (
    <div className="grid gap-2">
      {feedItems.map((feed, i) => (
        <FeedCard key={i} data={feed} variant="preloaded" />
      ))}
    </div>
  )
}
