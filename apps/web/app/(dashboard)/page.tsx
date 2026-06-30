import { HeroCarousel } from "@/components/content/hero-carousel"
import { PageCard } from "@/components/content/page-card"
import { FeedCard } from "@/components/content/feed-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { RecommendedSection } from "@/components/content/recommended-section"
import { Pill } from "@/components/content/pill"
import { Stat } from "@/components/content/stats-row"
import { T } from "@/components/content/i18n-text"
import { Eye } from "lucide-react"
import { listRanking, listMoments } from "@/lib/services/community"
import { db, publishedPages, users } from "@/lib/db"
import { desc, eq, and, ne } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import type { HeroSlideData } from "@/components/content/hero-carousel"
import type { PageCardData } from "@/components/content/page-card"
import type { FeedCardData } from "@/components/content/feed-card"
import type { AuthorCardData } from "@/components/content/author-card"

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

const HERO_COLORS = [
  { bg1: "#0891b2", bg2: "#06b6d4", accent: "#22d3ee" },
  { bg1: "#7c3aed", bg2: "#a855f7", accent: "#c084fc" },
  { bg1: "#059669", bg2: "#10b981", accent: "#34d399" },
  { bg1: "#ea580c", bg2: "#f97316", accent: "#fb923c" },
]

export default async function HomePage() {
  const session = await getSession()

  const [
    rankingResult,
    latestPages,
    momentsResult,
    topAuthors,
  ] = await Promise.all([
    listRanking({ rankingKey: "popular_pages", timeWindow: "7d", limit: 10 }),
    db.select({
      uid: publishedPages.uid,
      title: publishedPages.title,
      coverUrl: publishedPages.coverUrl,
      authorName: publishedPages.authorName,
      authorAvatarUrl: publishedPages.authorAvatarUrl,
      lastPublishedAt: publishedPages.lastPublishedAt,
      viewCount: publishedPages.viewCount,
      commentCount: publishedPages.commentCount,
      userSlug: users.userSlug,
    }).from(publishedPages)
      .innerJoin(users, eq(users.id, publishedPages.userId))
      .where(and(
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(publishedPages.lastPublishedAt))
      .limit(6),
    listMoments({ feedType: "recommended", session, limit: 5 }),
    session?.userId
      ? db.select().from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(3)
      : db.select().from(users).orderBy(desc(users.followersCount)).limit(3),
  ])

  // Hero slides from ranking
  const rankingItems = rankingResult.items
  const heroSlides: HeroSlideData[] = rankingItems.slice(0, 4).map((item, i) => ({
    title: item.title,
    subtitle: item.description ?? "",
    image: "",
    ...HERO_COLORS[i % HERO_COLORS.length],
    stats: {
      views: item.view_count ?? 0,
      likes: item.like_count ?? 0,
      comments: item.comment_count ?? 0,
    },
  }))

  // Featured pages (rank 0-2)
  const featuredPages: PageCardData[] = rankingItems.slice(0, 3).map((item) => ({
    cover: gradientCover(item.title),
    title: item.title,
    author: {
      name: item.author_name ?? item.user_slug ?? "?",
      fallbackText: (item.author_name ?? item.user_slug)?.[0] ?? "?",
      avatarUrl: item.author_avatar_url ?? undefined,
    },
    timeAgo: timeAgo(null),
    stats: { views: item.view_count ?? 0, comments: item.comment_count ?? 0 },
  }))

  // Recommended pages (latest published)
  const recommendedPages: PageCardData[] = latestPages.map((p) => ({
    cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
    title: p.title,
    author: {
      name: p.authorName ?? "?",
      fallbackText: p.authorName?.[0] ?? "?",
      avatarUrl: p.authorAvatarUrl ?? undefined,
    },
    timeAgo: timeAgo(p.lastPublishedAt),
    stats: { views: p.viewCount, comments: p.commentCount },
  }))

  // Build recommended page entries with proper href for the client section
  const recommendedEntries = latestPages.map((p, i) => ({
    data: recommendedPages[i],
    href: `/read/${encodeURIComponent(p.userSlug)}/${encodeURIComponent(p.uid)}`,
  }))

  // Feed from moments
  const feedItems: FeedCardData[] = momentsResult.items.map((item) => ({
    head: {
      fallbackText: item.author.display_name?.[0] ?? "?",
      avatarUrl: item.author.avatar_url ?? undefined,
      name: item.author.display_name,
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

  // Authors sidebar
  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName?.[0] ?? "?",
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <div className="grid gap-[14px] lg:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}

        <section>
          <SectionHead title="精选页面" actionLabel={<T tKey="community.more" fallback="更多" />} actionHref="/leaderboard" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {featuredPages.map((page, i) => (
              <PageCard
                key={i}
                data={page}
                variant="home"
                href={`/read/${encodeURIComponent(rankingItems[i].user_slug)}/${encodeURIComponent(rankingItems[i].page_id)}`}
              />
            ))}
          </div>
        </section>

        <RecommendedSection pages={recommendedEntries} />

        <section>
          <SectionHead title="动态" actionLabel={<T tKey="community.enter" fallback="进入" />} actionHref="/moment" />
          <div className="grid gap-2">
            {feedItems.map((feed, i) => (
              <FeedCard key={i} data={feed} variant="preloaded" />
            ))}
          </div>
        </section>
      </div>

      <aside className="grid gap-3 content-start">
        <section>
          <SectionHead title="推荐关注" actionLabel={<T tKey="community.viewAll" fallback="查看全部" />} actionHref="/search" />
          <div className="grid gap-2">
            {authorCards.map((author, i) => (
              <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
            ))}
          </div>
        </section>

        <section>
          <SectionHead title="本周上升" actionLabel={<T tKey="community.leaderboard" fallback="榜单" />} actionHref="/leaderboard" />
          <div className="grid gap-2">
            {featuredPages.slice(0, 2).map((page, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Pill variant="rank">{String(i + 1).padStart(2, "0")}</Pill>
                <span className="font-['Lexend'] text-[15px] font-bold truncate flex-1">{page.title}</span>
                <Stat icon={Eye} value={page.stats.views} format />
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
