import { db, publishedPages } from "@/lib/db"
import { eq, desc, and } from "drizzle-orm"
import { PageCard } from "@/components/content/page-card"
import { EmptyState } from "@/components/content/i18n-text"
import type { PageCardData } from "@/components/content/page-card"
import type { users as usersTable } from "@/lib/db"
import type { InferSelectModel } from "drizzle-orm"

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

type UserRow = InferSelectModel<typeof usersTable>

interface ProfilePagesProps {
  userId: string
  userSlug: string
  displayName: string | null
  avatarUrl: string | null
}

export async function ProfilePages({ userId, userSlug, displayName, avatarUrl }: ProfilePagesProps) {
  let authorPages: typeof publishedPages.$inferSelect[] = []

  try {
    authorPages = await db.select().from(publishedPages)
      .where(and(
        eq(publishedPages.userId, userId),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(publishedPages.lastPublishedAt))
      .limit(20)
  } catch (error) {
    console.error("[Profile] Failed to fetch pages:", error)
  }

  if (authorPages.length === 0) {
    return <EmptyState tKey="community.noPages" fallback="暂无公开页面" />
  }

  const pageCards = authorPages.map((p) => ({
    card: {
      cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
      title: p.title,
      description: p.description ?? undefined,
      author: {
        name: p.authorDisplayName ?? displayName ?? "?",
        fallbackText: p.authorDisplayName?.[0] ?? displayName?.[0] ?? "?",
        avatarUrl: p.authorAvatarUrl ?? avatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: {
        views: p.viewCount,
        likes: p.likeCount,
        comments: p.commentCount,
        bookmarks: p.bookmarkCount,
      },
    } satisfies PageCardData,
    href: `/${encodeURIComponent(userSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {pageCards.map((item, i) => (
        <PageCard key={i} data={item.card} variant="default" href={item.href} />
      ))}
    </div>
  )
}
