import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { ProfileTabs } from "@/components/profile/profile-tabs"
import { ActivityHeatmapLoader } from "@/components/profile/activity-heatmap-loader"
import { SectionHead } from "@/components/content/section-head"
import { db, publishedPages, users, moments, collections, communityReactions, communityEntities, communityFavorites } from "@/lib/db"
import { eq, desc, and, count } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { EmptyState, T } from "@/components/content/i18n-text"
import { CollectionCard } from "@/components/collections/collection-card"
import Link from "next/link"
import { Settings } from "lucide-react"
import type { PageCardData } from "@/components/content/page-card"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"
import type { ProfileHeroData } from "@/components/content/profile-hero"

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

/** Minimal shared shape between full publishedPages row and joined query results */
interface PageRow {
  uid: string
  title: string
  description: string | null
  coverUrl: string | null
  lastPublishedAt: Date | string | null
  viewCount: number
  likeCount: number
  commentCount: number
  favoriteCount: number
  authorName: string | null
  authorAvatarUrl: string | null
}

function mapPageToCard(
  p: PageRow,
  slug: string,
  fallbackDisplayName: string,
  fallbackAvatarUrl: string | null | undefined,
): { card: PageCardData; href: string } {
  return {
    card: {
      cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
      title: p.title,
      description: p.description ?? undefined,
      author: {
        name: p.authorName ?? fallbackDisplayName,
        fallbackText: p.authorName?.[0] ?? fallbackDisplayName[0] ?? "?",
        avatarUrl: p.authorAvatarUrl ?? fallbackAvatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: {
        views: p.viewCount,
        likes: p.likeCount,
        comments: p.commentCount,
        bookmarks: p.favoriteCount,
      },
    } satisfies PageCardData,
    href: `/${encodeURIComponent(slug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }
}

export default async function UserSlugPage({
  params,
}: {
  params: Promise<{ user_slug: string }>
}) {
  const { user_slug: slug } = await params
  const session = await getSession()

  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
  })

  if (!user) notFound()

  const isOwnProfile = session?.userId === user.id
  const displayName = user.displayName ?? "?"
  const avatarUrl = user.avatarUrl

  // Columns to select from publishedPages in joined queries
  const pageColumns = {
    uid: publishedPages.uid,
    title: publishedPages.title,
    description: publishedPages.description,
    coverUrl: publishedPages.coverUrl,
    lastPublishedAt: publishedPages.lastPublishedAt,
    viewCount: publishedPages.viewCount,
    likeCount: publishedPages.likeCount,
    commentCount: publishedPages.commentCount,
    favoriteCount: publishedPages.favoriteCount,
    authorName: publishedPages.authorName,
    authorAvatarUrl: publishedPages.authorAvatarUrl,
  }

  const [
    authorPages,
    authorMoments,
    pageCountResult,
    createdCollections,
    likedPageRows,
    favoritedPageRows,
    pinnedPageRows,
    profileReadmePage,
  ] = await Promise.all([
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
    db.select({ count: count() }).from(publishedPages)
      .where(and(
        eq(publishedPages.userId, user.id),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      )),
    db.select().from(collections)
      .where(eq(collections.ownerId, user.id))
      .orderBy(desc(collections.updatedAt))
      .limit(20),
    db.select(pageColumns)
      .from(communityReactions)
      .innerJoin(communityEntities, eq(communityEntities.id, communityReactions.communityEntityId))
      .innerJoin(publishedPages, eq(publishedPages.id, communityEntities.entityId))
      .where(and(
        eq(communityReactions.userId, user.id),
        eq(communityReactions.reactionType, "like"),
        eq(communityEntities.entityType, "published_page"),
        eq(communityEntities.status, "active"),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(communityReactions.createdAt))
      .limit(20),
    db.select(pageColumns)
      .from(communityFavorites)
      .innerJoin(communityEntities, eq(communityEntities.id, communityFavorites.communityEntityId))
      .innerJoin(publishedPages, eq(publishedPages.id, communityEntities.entityId))
      .where(and(
        eq(communityFavorites.userId, user.id),
        eq(communityEntities.entityType, "published_page"),
        eq(communityEntities.status, "active"),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(communityFavorites.createdAt))
      .limit(20),
    // Pinned pages (up to 6)
    db.select().from(publishedPages)
      .where(and(
        eq(publishedPages.userId, user.id),
        eq(publishedPages.isPinned, true),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(publishedPages.pinnedAt))
      .limit(6),
    // Profile README: page where uid === userSlug
    db.select().from(publishedPages)
      .where(and(
        eq(publishedPages.userId, user.id),
        eq(publishedPages.uid, user.userSlug),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .limit(1),
  ])

  const pageCards = authorPages.map((p) => mapPageToCard(p, slug, displayName, avatarUrl))
  const pinnedCards = pinnedPageRows.map((p) => mapPageToCard(p, slug, displayName, avatarUrl))
  const readmePage = profileReadmePage[0]
  const likedCards = likedPageRows.map((p) => mapPageToCard(p, slug, displayName, avatarUrl))
  const favoritedCards = favoritedPageRows.map((p) => mapPageToCard(p, slug, displayName, avatarUrl))

  const feedCards: FeedCardData[] = authorMoments.map((m) => ({
    head: {
      fallbackText: displayName[0] ?? "?",
      avatarUrl: avatarUrl ?? undefined,
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
    },
  }))

  const createdCollectionCards = createdCollections.map((c) => ({
    collection: {
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
    },
  }))

  return (
    <div className="grid gap-4">
      <ProfileTabs
        overview={
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Left sidebar */}
            <div className="space-y-4">
              <div className="flex flex-col items-center lg:items-start gap-3">
                <Avatar className="size-20 lg:size-24 rounded-full ring-2 ring-border/60">
                  <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
                  <AvatarFallback className="text-2xl">{displayName[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="text-center lg:text-left">
                  <h2 className="text-xl font-bold">{user.displayName}</h2>
                  <p className="text-sm text-muted-foreground">@{user.userSlug}</p>
                </div>
              </div>
              {user.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
              )}
              {user.websiteUrl && (
                <a
                  href={user.websiteUrl.startsWith("http") ? user.websiteUrl : `https://${user.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  {user.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="font-semibold">{user.followersCount}</span>{" "}
                  <span className="text-muted-foreground">关注者</span>
                </div>
                <div>
                  <span className="font-semibold">{pageCountResult[0]?.count ?? 0}</span>{" "}
                  <span className="text-muted-foreground">页面</span>
                </div>
              </div>
              {isOwnProfile && (
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center w-full gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-secondary hover:text-foreground transition-colors"
                >
                  <Settings className="size-3.5" />
                  <T tKey="profile.editProfile" fallback="编辑资料" />
                </Link>
              )}
            </div>

            {/* Right area */}
            <div className="space-y-5 min-w-0">
              {/* Profile README */}
              {readmePage && (
                <section className="rounded-xl border border-border overflow-hidden">
                  <iframe
                    title="Profile README"
                    srcDoc={readmePage.html}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full border-0"
                    style={{ height: Math.min(500, (readmePage.html.length / 50) + 100) + 'px' }}
                  />
                </section>
              )}

              {/* Pinned pages */}
              {pinnedCards.length > 0 && (
                <section>
                  <SectionHead title="置顶页面" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {pinnedCards.map((item, i) => (
                      <PageCard key={i} data={item.card} variant="default" href={item.href} hideAuthor />
                    ))}
                  </div>
                </section>
              )}

              {/* Activity heatmap (lazy-loaded) */}
              <ActivityHeatmapLoader userSlug={user.userSlug} />

              {/* Recent moments */}
              {feedCards.length > 0 && (
                <section>
                  <SectionHead title="最近动态" />
                  <div className="grid gap-2">
                    {feedCards.slice(0, 5).map((feed, i) => (
                      <FeedCard key={i} data={feed} variant="rich" />
                    ))}
                  </div>
                </section>
              )}

              {!readmePage && pinnedCards.length === 0 && feedCards.length === 0 && (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <p>暂无内容</p>
                </div>
              )}
            </div>
          </div>
        }
        pages={
          <>
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
          </>
        }
        likes={
          <>
            <SectionHead title="喜欢的页面" />
            {likedCards.length === 0 ? (
              <EmptyState tKey="community.noLikedPages" fallback="暂无喜欢的页面" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {likedCards.map((item, i) => (
                  <PageCard key={i} data={item.card} variant="default" href={item.href} />
                ))}
              </div>
            )}
          </>
        }
        favorites={
          <>
            <SectionHead title="收藏的页面" />
            {favoritedCards.length === 0 ? (
              <EmptyState tKey="community.noFavoritedPages" fallback="暂无收藏的页面" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {favoritedCards.map((item, i) => (
                  <PageCard key={i} data={item.card} variant="default" href={item.href} />
                ))}
              </div>
            )}
          </>
        }
        moments={
          feedCards.length === 0 ? (
            <EmptyState tKey="community.noMoments" fallback="暂无动态" />
          ) : (
            <div className="grid gap-2">
              {feedCards.map((feed, i) => (
                <FeedCard key={i} data={feed} variant="rich" />
              ))}
            </div>
          )
        }
        collections={
          <>
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
          </>
        }
        pageCount={pageCountResult[0]?.count ?? 0}
        likeCount={likedCards.length}
        favoriteCount={favoritedCards.length}
        momentCount={feedCards.length}
        collectionCount={createdCollectionCards.length}
      />
    </div>
  )
}
