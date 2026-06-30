import { ProfileHero } from "@/components/content/profile-hero"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { SectionHead } from "@/components/content/section-head"
import { db, publishedPages, users, moments, collections } from "@/lib/db"
import { eq, desc, and, count } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { EmptyState, T } from "@/components/content/i18n-text"
import { CollectionCard } from "@/components/collections/collection-card"
import Link from "next/link"
import { LogIn } from "lucide-react"
import type { PageCardData } from "@/components/content/page-card"
import type { ProfileHeroData } from "@/components/content/profile-hero"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"

export const dynamic = "force-dynamic"

const PROFILE_TABS = ["页面", "动态", "合集", "关于"]

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

const FEED_KIND_MAP: Record<string, FeedKind> = {
  post: "发布",
  page_update: "更新",
  repost: "转发",
  system: "更新",
}

export default async function ProfilePage() {
  const session = await getSession()

  // 未登录时展示友好提示（不执行 redirect，避免 session 丢失体验）
  if (!session?.userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold"><T tKey="auth.signInRequired" fallback="需要登录" /></h2>
          <p className="text-muted-foreground"><T tKey="auth.signInRequiredDescription" fallback="请登录以访问此功能" /></p>
        </div>
        <Link
          href={`/login?redirect=${encodeURIComponent("/profile")}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-bold hover:opacity-90 transition-opacity"
        >
          <LogIn className="size-4" />
          <T tKey="auth.signIn" fallback="登录" />
        </Link>
      </div>
    )
  }

  let user
  try {
    user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    })
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <EmptyState tKey="common.error" fallback="加载失败，请稍后重试" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <EmptyState tKey="common.error" fallback="用户数据未找到" />
      </div>
    )
  }

  // 数据获取 — try/catch 保护，避免 DB 异常导致页面崩溃
  let authorPages: typeof publishedPages.$inferSelect[] = []
  let authorMoments: typeof moments.$inferSelect[] = []
  let userCollections: typeof collections.$inferSelect[] = []
  let pageCountResult: { count: number }[] = [{ count: 0 }]

  try {
    [authorPages, authorMoments, userCollections, pageCountResult] = await Promise.all([
      db.select().from(publishedPages)
        .where(and(
          eq(publishedPages.userId, user.id),
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved")
        ))
        .orderBy(desc(publishedPages.lastPublishedAt))
        .limit(20),
      db.select().from(moments)
        .where(and(
          eq(moments.authorUserId, user.id),
          eq(moments.visibility, "public"),
          eq(moments.isDeleted, false)
        ))
        .orderBy(desc(moments.createdAt))
        .limit(10),
      db.select().from(collections)
        .where(eq(collections.ownerId, user.id))
        .orderBy(desc(collections.updatedAt))
        .limit(10),
      db.select({ count: count() }).from(publishedPages)
        .where(and(
          eq(publishedPages.userId, user.id),
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved")
        )),
    ])
  } catch (error) {
    console.error("[Profile] Failed to fetch profile data:", error)
  }

  const profile: ProfileHeroData = {
    fallbackText: user.displayName?.[0] ?? "?",
    avatarUrl: user.avatarUrl ?? undefined,
    name: user.displayName,
    handle: `@${user.userSlug}`,
    userSlug: user.userSlug,
    tagline: user.bio ?? "",
    stats: {
      followers: user.followersCount,
      pages: pageCountResult[0]?.count ?? 0,
    },
  }

  const pageCards = authorPages.map((p) => ({
    card: {
      cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
      title: p.title,
      description: p.description ?? undefined,
      author: {
        name: p.authorName ?? user.displayName,
        fallbackText: p.authorName?.[0] ?? user.displayName?.[0] ?? "?",
        avatarUrl: p.authorAvatarUrl ?? user.avatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: {
        views: p.viewCount,
        likes: p.likeCount,
        comments: p.commentCount,
        bookmarks: p.favoriteCount,
      },
    } satisfies PageCardData,
    href: `/read/${encodeURIComponent(user.userSlug)}/${encodeURIComponent(p.uid)}`,
  }))

  const feedCards: FeedCardData[] = authorMoments.map((m) => ({
    head: {
      fallbackText: user.displayName?.[0] ?? "?",
      avatarUrl: user.avatarUrl ?? undefined,
      name: user.displayName,
      handle: `@${user.userSlug}`,
      userSlug: user.userSlug,
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
    <div className="grid gap-4">
      <ProfileHero data={profile} currentUserSlug={user.userSlug} />
      <VibenTabs defaultValue="页面">
        <VibenTabsList>
          {PROFILE_TABS.map((tab) => (
            <VibenTabsTrigger key={tab} value={tab}>{tab}</VibenTabsTrigger>
          ))}
        </VibenTabsList>

        <VibenTabsContent value="页面" className="mt-3">
          <SectionHead title="公开页面" />
          {pageCards.length === 0 ? (
            <EmptyState tKey="community.noPages" fallback="暂无公开页面" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {pageCards.map((item, i) => (
                <PageCard key={i} data={item.card} variant="default" href={item.href} />
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="动态" className="mt-3">
          {feedCards.length === 0 ? (
            <EmptyState tKey="community.noMoments" fallback="暂无动态" />
          ) : (
            <div className="grid gap-2">
              {feedCards.map((feed, i) => (
                <FeedCard key={i} data={feed} variant="rich" />
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="合集" className="mt-3">
          <SectionHead title="创建的合集" />
          {userCollections.length === 0 ? (
            <EmptyState tKey="community.noCollections" fallback="暂无创建的合集" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {userCollections.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={{
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description ?? null,
                    isPublic: c.isPublic,
                    itemCount: c.itemCount,
                    forksCount: c.forksCount,
                    favoritesCount: c.favoritesCount,
                    owner: {
                      id: user.id,
                      username: user.username ?? user.userSlug,
                      displayName: user.displayName ?? user.userSlug,
                      avatarUrl: user.avatarUrl,
                    },
                  }}
                  isOwner
                />
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="关于" className="mt-3">
          <div className="max-w-[760px] text-sm text-muted-foreground leading-relaxed space-y-3">
            {user.bio ? (
              <p>{user.bio}</p>
            ) : (
              <p><T tKey="community.noDescription" fallback="还没有填写简介。" /></p>
            )}
          </div>
        </VibenTabsContent>
      </VibenTabs>
    </div>
  )
}
