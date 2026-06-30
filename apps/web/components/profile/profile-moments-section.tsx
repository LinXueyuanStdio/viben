import { db, moments } from "@/lib/db"
import { eq, desc, and } from "drizzle-orm"
import { FeedCard } from "@/components/content/feed-card"
import { EmptyState } from "@/components/content/i18n-text"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"

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

const FEED_KIND_MAP: Record<string, FeedKind> = {
  post: "发布",
  page_update: "更新",
  repost: "转发",
  system: "更新",
}

interface ProfileMomentsProps {
  userId: string
  userSlug: string
  displayName: string | null
  avatarUrl: string | null
}

export async function ProfileMoments({ userId, userSlug, displayName, avatarUrl }: ProfileMomentsProps) {
  let authorMoments: typeof moments.$inferSelect[] = []

  try {
    authorMoments = await db.select().from(moments)
      .where(and(
        eq(moments.authorUserId, userId),
        eq(moments.visibility, "public"),
        eq(moments.isDeleted, false)
      ))
      .orderBy(desc(moments.createdAt))
      .limit(10)
  } catch (error) {
    console.error("[Profile] Failed to fetch moments:", error)
  }

  if (authorMoments.length === 0) {
    return <EmptyState tKey="community.noMoments" fallback="暂无动态" />
  }

  const feedCards: FeedCardData[] = authorMoments.map((m) => ({
    head: {
      fallbackText: displayName?.[0] ?? "?",
      avatarUrl: avatarUrl ?? undefined,
      name: displayName ?? "?",
      handle: `@${userSlug}`,
      userSlug,
      kind: FEED_KIND_MAP[m.kind] ?? "发布",
      timeAgo: timeAgo(m.createdAt),
      source: m.source ?? undefined,
    },
    text: m.body ?? "",
    quote: m.quoteText ?? undefined,
    actions: {
      views: m.viewCount ?? 0,
      likes: m.likeCount,
      comments: m.commentCount,
      reposts: m.repostCount,
      bookmarks: m.bookmarkCount ?? 0,
      momentId: m.id,
      shareUrl: `/moment/${m.id}`,
      hasLiked: false,
      hasBookmarked: false,
    },
  }))

  return (
    <div className="grid gap-2">
      {feedCards.map((feed, i) => (
        <FeedCard key={i} data={feed} variant="rich" />
      ))}
    </div>
  )
}
