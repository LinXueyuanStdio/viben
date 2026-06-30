import { ProfileHero } from "@/components/content/profile-hero"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { ProfileTabs } from "@/components/profile/profile-tabs"
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
import type { ProfileHeroData } from "@/components/content/profile-hero"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"

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
  ])

  const profile: ProfileHeroData = {
    fallbackText: displayName[0] ?? "?",
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

  const pageCards = authorPages.map((p) => mapPageToCard(p, slug, displayName, avatarUrl))
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
      <ProfileHero data={profile} currentUserSlug={session?.userSlug} />
      {isOwnProfile && (
        <div className="flex justify-end">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="size-3.5" />
            <T tKey="profile.editProfile" fallback="编辑资料" />
          </Link>
        </div>
      )}
      <ProfileTabs
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
        about={
          <div className="max-w-[760px] text-sm text-muted-foreground leading-relaxed space-y-3">
            {user.bio ? (
              <p>{user.bio}</p>
            ) : (
              <p>
                <T tKey="community.noDescription" fallback="这位用户还没有填写简介。" />
              </p>
            )}
          </div>
        }
      />
    </div>
  )
}
