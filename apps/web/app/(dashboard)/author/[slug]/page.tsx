import { ProfileHero } from "@/components/content/profile-hero"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { SectionHead } from "@/components/content/section-head"
import { db, publishedPages, users, moments, collections, favorites } from "@/lib/db"
import { eq, desc, and, count } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { EmptyState, T } from "@/components/content/i18n-text"
import { CollectionCard } from "@/components/collections/collection-card"
import type { PageCardData } from "@/components/content/page-card"
import type { ProfileHeroData } from "@/components/content/profile-hero"
import type { FeedCardData } from "@/components/content/feed-card"
import type { FeedKind } from "@/components/content/feed-head"

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

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()

  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
  })

  if (!user) notFound()

  const [authorPages, authorMoments, pageCountResult, createdCollections, favoritedCollections] = await Promise.all([
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
      .where(and(
        eq(collections.ownerId, user.id),
        eq(collections.isPublic, true)
      ))
      .orderBy(desc(collections.updatedAt))
      .limit(20),
    db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        isPublic: collections.isPublic,
        itemCount: collections.itemCount,
        forksCount: collections.forksCount,
        favoritesCount: collections.favoritesCount,
        owner: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(favorites)
      .innerJoin(collections, and(
        eq(collections.id, favorites.entityId),
        eq(collections.isPublic, true)
      ))
      .innerJoin(users, eq(users.id, collections.ownerId))
      .where(and(
        eq(favorites.userId, user.id),
        eq(favorites.entityType, "collection")
      ))
      .orderBy(desc(favorites.createdAt))
      .limit(20),
  ])

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
    shareUrl: `/author/${encodeURIComponent(user.userSlug)}`,
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

  const favoritedCollectionCards = favoritedCollections.map((row) => ({
    collection: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      isPublic: row.isPublic,
      itemCount: row.itemCount,
      forksCount: row.forksCount,
      favoritesCount: row.favoritesCount,
      owner: {
        id: row.owner.id,
        username: row.owner.username,
        displayName: row.owner.displayName ?? row.owner.username,
        avatarUrl: row.owner.avatarUrl,
      },
    },
  }))

  const unusedSession = session // 预备后续交互功能使用

  return (
    <div className="grid gap-4">
      <ProfileHero data={profile} currentUserSlug={session?.userSlug} />
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
