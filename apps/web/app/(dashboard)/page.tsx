import { Suspense } from "react"
import { HeroCarousel } from "@/components/content/hero-carousel"
import { PageCard } from "@/components/content/page-card"
import { SectionHead } from "@/components/content/section-head"
import { RecommendedSection } from "@/components/content/recommended-section"
import { T } from "@/components/content/i18n-text"
import { HomeFeedSection } from "@/components/home/home-feed-section"
import { HomeSidebarSection } from "@/components/home/home-sidebar-section"
import { FeedSkeleton } from "@/components/shared/skeletons"
import { Footer } from "@/components/layout/footer"
import { getHomePageData, getHomeTopAuthors } from "@/lib/services/community"
import type { HomePageData, HomePageAuthors } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { timeAgo } from "@/lib/services/moment-mapper"
import type { HeroSlideData } from "@/components/content/hero-carousel"
import type { PageCardData } from "@/components/content/page-card"
import type { Metadata } from "next"
import { makeOG, makeTwitter, APP_URL } from "@/lib/metadata"

export const metadata: Metadata = {
  title: "Viben - 创作 · 分享 · 连接",
  description: "Viben 是一个面向创作者的社区平台，支持富文本页面创作、动态分享、合集管理。",
  alternates: {
    canonical: APP_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: makeOG({
    title: "Viben - 创作 · 分享 · 连接",
    description: "Viben 是一个面向创作者的社区平台，支持富文本页面创作、动态分享、合集管理。",
    url: APP_URL,
    type: "website",
  }),
  twitter: makeTwitter({
    title: "Viben - 创作 · 分享 · 连接",
    description: "Viben 是一个面向创作者的社区平台，支持富文本页面创作、动态分享、合集管理。",
  }),
}

const HERO_COLORS = [
  { bg1: "#0891b2", bg2: "#06b6d4", accent: "#22d3ee" },
  { bg1: "#7c3aed", bg2: "#a855f7", accent: "#c084fc" },
  { bg1: "#059669", bg2: "#10b981", accent: "#34d399" },
  { bg1: "#ea580c", bg2: "#f97316", accent: "#fb923c" },
]

export default async function HomePage() {
  const session = await getSession()

  let heroSlides: HeroSlideData[] = []
  let featuredPages: PageCardData[] = []
  let recommendedEntries: Array<{ data: PageCardData; href: string }> = []
  let rankingItemsReadUrls: Array<{ user_slug: string; page_id: string }> = []
  let sidebarAuthors: HomePageAuthors[] = []
  let sidebarRankingPages: Array<{ title: string; stats: { views: number } }> = []

  try {
    const [data, allAuthors] = await Promise.all([
      getHomePageData(),
      getHomeTopAuthors(),
    ])

    // 过滤当前用户，取前 3
    const authors = allAuthors
      .filter((u) => u.id !== (session?.userId ?? ""))
      .slice(0, 3)

    const rankingItems = data.rankingItems.filter((item) => item.cover_url != null)

    heroSlides = rankingItems.slice(0, 4).map((item, i) => ({
      title: item.title,
      subtitle: item.description ?? "",
      coverUrl: item.cover_url,
      href: item.read_url ?? undefined,
      ...HERO_COLORS[i % HERO_COLORS.length],
      stats: {
        views: item.view_count ?? 0,
        likes: item.like_count ?? 0,
        comments: item.comment_count ?? 0,
      },
    }))

    featuredPages = rankingItems.slice(0, 3).map((item) => ({
      coverUrl: item.cover_url,
      title: item.title,
      author: {
        name: item.author_display_name ?? item.user_slug,
        avatarUrl: item.author_avatar_url ?? undefined,
      },
      timeAgo: timeAgo(item.last_published_at ?? item.published_at),
      stats: { views: item.view_count ?? 0, likes: item.like_count ?? 0, comments: item.comment_count ?? 0 },
    }))

    rankingItemsReadUrls = rankingItems.slice(0, 3).map((item) => ({
      user_slug: item.user_slug,
      page_id: item.page_id,
    }))

    const recommendedPages: PageCardData[] = data.latestPages.map((p) => ({
      coverUrl: p.coverUrl,
      title: p.title,
      author: {
        name: p.authorDisplayName || p.authorSlug,
        avatarUrl: p.authorAvatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: { views: p.viewCount, likes: p.likeCount, comments: p.commentCount },
    }))

    recommendedEntries = data.latestPages.map((p, i) => ({
      data: recommendedPages[i],
      href: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
    }))

    sidebarAuthors = authors
    sidebarRankingPages = data.rankingItems.slice(0, 3).map((item) => ({
      title: item.title,
      stats: { views: item.view_count ?? 0 },
    }))
  } catch (error) {
    console.error("[Home] Failed to fetch page data:", error)
  }

  // 预加载跑马灯前 2 张封面图，减少切换闪烁
  const preloadUrls = heroSlides
    .filter((s) => s.coverUrl)
    .slice(0, 2)
    .map((s) => s.coverUrl!)

  return (
    <>
      {preloadUrls.map((url) => (
        <link key={url} rel="preload" as="image" href={url} />
      ))}
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

      <HomeSidebarSection
        authorCards={sidebarAuthors}
        rankingPages={sidebarRankingPages}
      />
    </div>
    <Footer />
    </>
  )
}
