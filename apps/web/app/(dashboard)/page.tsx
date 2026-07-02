import { Suspense } from "react"
import { HeroCarousel } from "@/components/content/hero-carousel"
import { PageCard } from "@/components/content/page-card"
import { SectionHead } from "@/components/content/section-head"
import { RecommendedSection } from "@/components/content/recommended-section"
import { T } from "@/components/content/i18n-text"
import { HomeFeedSection } from "@/components/home/home-feed-section"
import { HomeSidebarSection } from "@/components/home/home-sidebar-section"
import { FeedSkeleton } from "@/components/shared/skeletons"
import { listRanking } from "@/lib/services/community"
import { db, publishedPages } from "@/lib/db"
import { desc, eq, and } from "drizzle-orm"
import type { HeroSlideData } from "@/components/content/hero-carousel"
import type { PageCardData } from "@/components/content/page-card"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Viben - 创作 · 分享 · 连接",
  description: "Viben 是一个面向创作者的社区平台，支持富文本页面创作、动态分享、合集管理。",
  openGraph: {
    title: "Viben - 创作 · 分享 · 连接",
    description: "Viben 是一个面向创作者的社区平台，支持富文本页面创作、动态分享、合集管理。",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Viben - 创作 · 分享 · 连接",
    description: "Viben 是一个面向创作者的社区平台，支持富文本页面创作、动态分享、合集管理。",
  },
}

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

const HERO_COLORS = [
  { bg1: "#0891b2", bg2: "#06b6d4", accent: "#22d3ee" },
  { bg1: "#7c3aed", bg2: "#a855f7", accent: "#c084fc" },
  { bg1: "#059669", bg2: "#10b981", accent: "#34d399" },
  { bg1: "#ea580c", bg2: "#f97316", accent: "#fb923c" },
]

export default async function HomePage() {
  // 独立数据获取（hero + 精选 + 推荐区块共享排名和最新页面数据）
  let heroSlides: HeroSlideData[] = []
  let featuredPages: PageCardData[] = []
  let recommendedEntries: Array<{ data: PageCardData; href: string }> = []
  let rankingItemsReadUrls: Array<{ user_slug: string; page_id: string }> = []

  try {
    const [rankingResult, latestPages] = await Promise.all([
      listRanking({ rankingKey: "popular_pages", timeWindow: "7d", limit: 10 }),
      db.select({
        uid: publishedPages.uid,
        title: publishedPages.title,
        coverUrl: publishedPages.coverUrl,
        authorDisplayName: publishedPages.authorDisplayName,
        authorAvatarUrl: publishedPages.authorAvatarUrl,
        authorSlug: publishedPages.authorSlug,
        lastPublishedAt: publishedPages.lastPublishedAt,
        viewCount: publishedPages.viewCount,
        commentCount: publishedPages.commentCount,
      }).from(publishedPages)
        .where(and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved")
        ))
        .orderBy(desc(publishedPages.lastPublishedAt))
        .limit(6),
    ])

    const rankingItems = rankingResult.items

    heroSlides = rankingItems.slice(0, 4).map((item, i) => ({
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

    featuredPages = rankingItems.slice(0, 3).map((item) => ({
      cover: gradientCover(item.title),
      title: item.title,
      author: {
        name: item.author_display_name ?? item.user_slug ?? "?",
        fallbackText: (item.author_display_name ?? item.user_slug)?.[0] ?? "?",
        avatarUrl: item.author_avatar_url ?? undefined,
      },
      timeAgo: timeAgo(null),
      stats: { views: item.view_count ?? 0, comments: item.comment_count ?? 0 },
    }))

    rankingItemsReadUrls = rankingItems.slice(0, 3).map((item) => ({
      user_slug: item.user_slug,
      page_id: item.page_id,
    }))

    const recommendedPages: PageCardData[] = latestPages.map((p) => ({
      cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
      title: p.title,
      author: {
        name: p.authorDisplayName ?? "?",
        fallbackText: p.authorDisplayName?.[0] ?? "?",
        avatarUrl: p.authorAvatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: { views: p.viewCount, comments: p.commentCount },
    }))

    recommendedEntries = latestPages.map((p, i) => ({
      data: recommendedPages[i],
      href: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
    }))
  } catch (error) {
    console.error("[Home] Failed to fetch page data:", error)
  }

  return (
    <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}

        {featuredPages.length > 0 && (
          <section>
            <SectionHead title="精选页面" actionLabel={<T tKey="community.more" fallback="更多" />} actionHref="/leaderboard" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {featuredPages.map((page, i) => (
                <PageCard
                  key={i}
                  data={page}
                  variant="home"
                  href={`/${encodeURIComponent(rankingItemsReadUrls[i]?.user_slug ?? "")}/${encodeURIComponent(rankingItemsReadUrls[i]?.page_id ?? "")}?tab=read`}
                />
              ))}
            </div>
          </section>
        )}

        {recommendedEntries.length > 0 && <RecommendedSection pages={recommendedEntries} />}

        {/* 动态流：Suspense 流式加载 */}
        <section>
          <SectionHead title="动态" actionLabel={<T tKey="community.enter" fallback="进入" />} actionHref="/moment" />
          <Suspense fallback={<FeedSkeleton count={3} />}>
            <HomeFeedSection />
          </Suspense>
        </section>
      </div>

      {/* 侧边栏：Suspense 流式加载 */}
      <Suspense fallback={
        <aside className="grid gap-3 content-start">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[96px] animate-pulse rounded-xl bg-muted" />
          ))}
        </aside>
      }>
        <HomeSidebarSection />
      </Suspense>
    </div>
  )
}
