import dynamic from "next/dynamic"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { SectionHead } from "@/components/content/section-head"
import { db, publishedPages, users, moments, collections, favorites } from "@/lib/db"
import { eq, desc, and, sql, gte, count } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { EmptyState, T } from "@/components/content/i18n-text"
import type { PageCardData } from "@/components/content/page-card"
import type { ProfileHeroData } from "@/components/content/profile-hero"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"
import type { PageActivityDay } from "@/components/content/page-activity-heatmap"

// ============================================
// Lazy-loaded heavy client components
//   (VibenTabs* kept eager — uses Radix Context)
// ============================================

const ProfileHero = dynamic(
  () => import("@/components/content/profile-hero").then(m => ({ default: m.ProfileHero })),
  { loading: () => <ProfileHeroSkeleton /> }
)

const PageCard = dynamic(
  () => import("@/components/content/page-card").then(m => ({ default: m.PageCard })),
  { loading: () => <CardSkeleton /> }
)

const FeedCard = dynamic(
  () => import("@/components/content/feed-card").then(m => ({ default: m.FeedCard })),
  { loading: () => <FeedSkeleton /> }
)

const PageActivityHeatmap = dynamic(
  () => import("@/components/content/page-activity-heatmap").then(m => ({ default: m.PageActivityHeatmap })),
  { loading: () => <HeatmapSkeleton /> }
)

const CollectionCard = dynamic(
  () => import("@/components/collections/collection-card").then(m => ({ default: m.CollectionCard })),
  { loading: () => <CardSkeleton /> }
)

// ============================================
// Skeleton fallbacks
// ============================================

function ProfileHeroSkeleton() {
  return (
    <div className="grid items-center gap-[14px] p-[14px] rounded-[12px] border bg-card shadow-sm animate-pulse"
      style={{ gridTemplateColumns: "58px 1fr auto" }}>
      <div className="size-[58px] rounded-full bg-muted" />
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
      <div className="h-9 w-20 rounded bg-muted" />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse space-y-3">
      <div className="h-32 rounded-lg bg-muted" />
      <div className="h-5 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse space-y-2">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
    </div>
  )
}

function HeatmapSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-muted mb-3" />
      <div className="h-[120px] rounded bg-muted" />
    </div>
  )
}

// ============================================
// Constants & Helpers
// ============================================

const AUTHOR_TABS = ["页面", "动态", "合集", "关于"]

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

function mapPageCard(p: typeof publishedPages.$inferSelect, displayName: string): PageCardData {
  return {
    cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
    title: p.title,
    description: p.description ?? undefined,
    author: {
      name: p.authorName ?? displayName,
      fallbackText: p.authorName?.[0] ?? displayName?.[0] ?? "?",
      avatarUrl: p.authorAvatarUrl ?? undefined,
    },
    timeAgo: timeAgo(p.lastPublishedAt),
    stats: {
      views: p.viewCount,
      likes: p.likeCount,
      comments: p.commentCount,
      bookmarks: p.favoriteCount,
    },
  }
}

// ============================================
// Page
// ============================================

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()

  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
  })

  if (!user) notFound()

  // Parallel data fetching
  const [
    profileReadmePage,
    pinnedPagesRaw,
    activityRows,
    allPages,
    authorMoments,
    pageCountResult,
    createdCollections,
    favoritedCollections,
  ] = await Promise.all([
    // Profile README
    db.select().from(publishedPages).where(and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.uid, user.userSlug),
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved")
    )).limit(1),
    // Pinned pages
    db.select().from(publishedPages).where(and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.isPinned, true),
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved")
    )).orderBy(desc(publishedPages.pinnedAt)).limit(6),
    // Activity data
    db.select({
      date: sql<string>`${publishedPages.publishedAt}::date`,
      count: sql<number>`count(*)::int`,
    }).from(publishedPages).where(and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.moderationStatus, "approved"),
      eq(publishedPages.visibility, "public"),
      gte(publishedPages.publishedAt, new Date(Date.now() - 365 * 24 * 3600 * 1000))
    )).groupBy(sql`${publishedPages.publishedAt}::date`).orderBy(sql`${publishedPages.publishedAt}::date`),
    // All pages (for non-pinned list)
    db.select().from(publishedPages).where(and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved")
    )).orderBy(desc(publishedPages.lastPublishedAt)).limit(50),
    // Moments
    db.select().from(moments).where(and(
      eq(moments.authorUserId, user.id),
      eq(moments.visibility, "public"),
      eq(moments.isDeleted, false)
    )).orderBy(desc(moments.createdAt)).limit(20),
    // Page stats
    db.select({ count: count() }).from(publishedPages).where(and(
      eq(publishedPages.userId, user.id),
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved")
    )),
    // Created collections
    db.select().from(collections).where(and(
      eq(collections.ownerId, user.id),
      eq(collections.isPublic, true)
    )).orderBy(desc(collections.updatedAt)).limit(20),
    // Favorited collections
    db.select({
      id: collections.id, name: collections.name, slug: collections.slug,
      description: collections.description, isPublic: collections.isPublic,
      itemCount: collections.itemCount, forksCount: collections.forksCount,
      favoritesCount: collections.favoritesCount,
      owner: { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl },
    }).from(favorites).innerJoin(collections, and(
      eq(collections.id, favorites.entityId), eq(collections.isPublic, true)
    )).innerJoin(users, eq(users.id, collections.ownerId)).where(and(
      eq(favorites.userId, user.id), eq(favorites.entityType, "collection")
    )).orderBy(desc(favorites.createdAt)).limit(20),
  ])

  // Derived data
  const profileReadme = profileReadmePage[0] ?? null
  const activityData: PageActivityDay[] = activityRows.map((r) => ({
    date: String(r.date).split('T')[0],
    count: Number(r.count),
  }))

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

  const pinnedIds = new Set(pinnedPagesRaw.map((p) => p.id))
  const nonPinnedPages = allPages.filter((p) => !pinnedIds.has(p.id))

  const pinnedCards = pinnedPagesRaw.map((p) => ({
    card: mapPageCard(p, user.displayName),
    href: `/${encodeURIComponent(user.userSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }))

  const pageCards = nonPinnedPages.map((p) => ({
    card: mapPageCard(p, user.displayName),
    href: `/${encodeURIComponent(user.userSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
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
    shareUrl: `/${encodeURIComponent(user.userSlug)}`,
    actions: {
      views: m.viewCount ?? 0,
      likes: m.likeCount,
      comments: m.commentCount,
      reposts: m.repostCount,
      bookmarks: m.bookmarkCount ?? 0,
    },
  }))

  const createdCollectionCards = createdCollections.map((c) => ({
    collection: {
      id: c.id, name: c.name, slug: c.slug, description: c.description ?? null,
      isPublic: c.isPublic, itemCount: c.itemCount, forksCount: c.forksCount,
      favoritesCount: c.favoritesCount,
      owner: {
        id: user.id, username: user.username ?? user.userSlug,
        displayName: user.displayName ?? user.userSlug, avatarUrl: user.avatarUrl,
      },
    },
  }))

  const favoritedCollectionCards = favoritedCollections.map((row) => ({
    collection: {
      id: row.id, name: row.name, slug: row.slug, description: row.description ?? null,
      isPublic: row.isPublic, itemCount: row.itemCount, forksCount: row.forksCount,
      favoritesCount: row.favoritesCount,
      owner: {
        id: row.owner.id, username: row.owner.username,
        displayName: row.owner.displayName ?? row.owner.username,
        avatarUrl: row.owner.avatarUrl,
      },
    },
  }))

  return (
    <div className="grid gap-4">
      {/* Profile Hero */}
      <ProfileHero data={profile} currentUserSlug={session?.userSlug} />

      {/* Profile README (same-name page embed) */}
      {profileReadme && (
        <section className="rounded-xl border bg-card p-6">
          <SectionHead
            title={profileReadme.title}
            actionLabel="View full page"
            actionHref={`/${encodeURIComponent(user.userSlug)}/${encodeURIComponent(profileReadme.uid)}?tab=read`}
          />
          <div
            className="prose prose-sm dark:prose-invert max-w-none mt-3"
            dangerouslySetInnerHTML={{ __html: profileReadme.html }}
          />
        </section>
      )}

      {/* Pinned Pages */}
      {pinnedCards.length > 0 && (
        <section>
          <SectionHead title="Pinned" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pinnedCards.map((item, i) => (
              <PageCard key={i} data={item.card} variant="default" href={item.href} hideAuthor />
            ))}
          </div>
        </section>
      )}

      {/* Activity Heatmap */}
      {activityData.length > 0 && <PageActivityHeatmap data={activityData} />}

      {/* Moments Stream */}
      {feedCards.length > 0 && (
        <section>
          <SectionHead title="Recent Activity" />
          <div className="grid gap-2">
            {feedCards.map((feed, i) => (
              <FeedCard key={i} data={feed} variant="rich" />
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <VibenTabs defaultValue="页面">
        <VibenTabsList>
          {AUTHOR_TABS.map((tab) => (
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
                <PageCard key={i} data={item.card} variant="default" href={item.href} hideAuthor />
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
          {createdCollectionCards.length === 0 ? (
            <EmptyState tKey="community.noCollections" fallback="暂无创建的合集" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {createdCollectionCards.map((item, i) => (
                <CollectionCard key={i} collection={item.collection} isOwner />
              ))}
            </div>
          )}
          <SectionHead title="收藏的合集" className="mt-6" />
          {favoritedCollectionCards.length === 0 ? (
            <EmptyState tKey="community.noFavoritedCollections" fallback="暂无收藏的合集" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {favoritedCollectionCards.map((item, i) => (
                <CollectionCard key={i} collection={item.collection} />
              ))}
            </div>
          )}
        </VibenTabsContent>

        <VibenTabsContent value="关于" className="mt-3">
          <div className="max-w-[760px] text-sm text-muted-foreground leading-relaxed space-y-3">
            {user.bio ? (
              <p>{user.bio}</p>
            ) : (
              <p>
                <T tKey="community.noDescription" fallback="这位作者还没有填写简介。" />
              </p>
            )}
          </div>
        </VibenTabsContent>
      </VibenTabs>
    </div>
  )
}
