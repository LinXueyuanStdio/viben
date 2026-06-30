import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { ProfileTabs } from "@/components/profile/profile-tabs"
import { ActivityHeatmapLoader } from "@/components/profile/activity-heatmap-loader"
import { SectionHead } from "@/components/content/section-head"
import { db, publishedPages, users, moments, collections, communityReactions, communityEntities, communityBookmarks } from "@/lib/db"
import { eq, desc, and, count } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { EmptyState, T } from "@/components/content/i18n-text"
import { CollectionCard } from "@/components/collections/collection-card"
import Link from "next/link"
import { Settings } from "lucide-react"
import type { PageCardData } from "@/components/content/page-card"
import type { FeedCardData } from "@/components/content/feed-card"
import type { ProfileHeroData } from "@/components/content/profile-hero"
import type { Metadata } from "next"
import { mapMomentRowToFeedCard, gradientCover, timeAgo } from "@/lib/services/moment-mapper"

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
  bookmarkCount: number
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
        bookmarks: p.bookmarkCount,
      },
    } satisfies PageCardData,
    href: `/${encodeURIComponent(slug)}/${encodeURIComponent(p.uid)}?tab=read`,
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user_slug: string }>
}): Promise<Metadata> {
  const { user_slug: slug } = await params
  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: {
      displayName: true,
      userSlug: true,
      bio: true,
      avatarUrl: true,
    },
  })

  if (!user) return { title: "未找到" }

  const displayName = user.displayName ?? user.userSlug
  const description = user.bio ?? `${displayName} 在 Viben 上的个人主页`

  return {
    title: `${displayName} (@${user.userSlug})`,
    description,
    openGraph: {
      title: `${displayName} (@${user.userSlug})`,
      description,
      type: "profile" as const,
      ...(user.avatarUrl
        ? { images: [{ url: user.avatarUrl, width: 256, height: 256 }] }
        : {}),
    },
    twitter: {
      card: "summary" as const,
      title: `${displayName} (@${user.userSlug})`,
      description,
      ...(user.avatarUrl ? { images: [user.avatarUrl] } : {}),
    },
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
    bookmarkCount: publishedPages.bookmarkCount,
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
    db.select(pageColumns).from(publishedPages)
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
      .from(communityBookmarks)
      .innerJoin(communityEntities, eq(communityEntities.id, communityBookmarks.communityEntityId))
      .innerJoin(publishedPages, eq(publishedPages.id, communityEntities.entityId))
      .where(and(
        eq(communityBookmarks.userId, user.id),
        eq(communityEntities.entityType, "published_page"),
        eq(communityEntities.status, "active"),
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(communityBookmarks.createdAt))
      .limit(20),
    // Pinned pages (up to 6)
    db.select(pageColumns).from(publishedPages)
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

  const feedCards: FeedCardData[] = authorMoments.map((m) =>
    mapMomentRowToFeedCard(m, {
      displayName: user.displayName,
      userSlug: user.userSlug,
      avatarUrl: user.avatarUrl,
    }),
  )

  const createdCollectionCards = createdCollections.map((c) => ({
    collection: {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      isPublic: c.isPublic,
      itemCount: c.itemCount,
      forksCount: c.forksCount,
      bookmarksCount: c.bookmarksCount,
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
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
            {/* Left sidebar */}
            <div className="space-y-3">
              {/* Avatar + identity */}
              <div className="flex flex-col items-center lg:items-start gap-2">
                {avatarUrl && (
                  <Avatar className="w-full max-w-[200px] h-auto aspect-square rounded-full">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="text-3xl font-semibold text-muted-foreground">
                      {displayName[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="text-center lg:text-left">
                  <h1 className="text-2xl font-bold tracking-tight leading-tight">
                    {user.displayName}
                  </h1>
                  <p className="text-[15px] text-muted-foreground font-light">
                    @{user.userSlug}
                  </p>
                </div>
              </div>

              {/* Bio */}
              {user.bio ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
              ) : isOwnProfile ? (
                <p className="text-sm text-muted-foreground/60 italic leading-relaxed">
                  <T tKey="profile.addBio" fallback="添加简介，向大家介绍自己…" />
                </p>
              ) : null}

              {/* Website */}
              {user.websiteUrl && (
                <a
                  href={user.websiteUrl.startsWith("http") ? user.websiteUrl : `https://${user.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 w-fit text-[13px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  {user.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              )}

              {/* Stats */}
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold tabular-nums">{user.followersCount}</span>
                  <span className="text-[13px] text-muted-foreground">关注者</span>
                </div>
                <span className="text-muted-foreground/30">·</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold tabular-nums">{pageCountResult[0]?.count ?? 0}</span>
                  <span className="text-[13px] text-muted-foreground">页面</span>
                </div>
              </div>

              {/* Edit profile */}
              {isOwnProfile && (
                <Link
                  href="/settings"
                  className="inline-flex items-center justify-center w-full gap-1.5 rounded-lg border border-border/60 bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-surface-secondary hover:text-foreground hover:border-border transition-all"
                >
                  <Settings className="size-3.5" />
                  <T tKey="profile.editProfile" fallback="编辑资料" />
                </Link>
              )}
            </div>

            {/* Right area */}
            <div className="space-y-4 min-w-0">
              {/* Profile README */}
              {readmePage && (
                <section>
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
                      <FeedCard key={i} data={feed} variant="rich" session={session ? { username: session.username, userSlug: session.userSlug, avatarUrl: session.avatarUrl } : null} />
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
                <FeedCard key={i} data={feed} variant="rich" session={session ? { username: session.username, userSlug: session.userSlug, avatarUrl: session.avatarUrl } : null} />
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
        bookmarkCount={favoritedCards.length}
        momentCount={feedCards.length}
        collectionCount={createdCollectionCards.length}
      />
    </div>
  )
}
