import { RankItem } from "@/components/content/rank-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { HomeTabBar } from "@/components/layout/home-tab-bar"
import { getCachedLeaderboard } from "@/lib/services/community"
import { EmptyState } from "@/components/content/i18n-text"
import type { RankItemData } from "@/components/content/rank-item"

const RANK_TABS = [
  { key: "最新热度", timeWindow: "1d" as const, label: "最新热度" },
  { key: "热门页面", timeWindow: "7d" as const, label: "热门页面" },
  { key: "月度精选", timeWindow: "30d" as const, label: "月度精选" },
]

export default async function LeaderboardPage() {
  const rankings = await getCachedLeaderboard()

  const tabData = RANK_TABS.reduce((acc, tab, i) => {
    const rawItems = rankings[i] ?? []
    acc[tab.key] = rawItems.map((item) => ({
      card: {
        rank: item.rank,
        coverUrl: item.cover_url,
        title: item.title,
        description: item.description ?? "",
        delta: item.delta ?? "—",
        author: {
          name: item.author_display_name ?? item.user_slug,
          avatarUrl: item.author_avatar_url ?? undefined,
        },
        stats: {
          views: item.view_count ?? 0,
          likes: item.like_count ?? 0,
          comments: item.comment_count ?? 0,
        },
        score: Math.round(item.score),
        scoreLabel: item.score_label ?? "热度",
      } satisfies RankItemData,
      href: `/${encodeURIComponent(item.user_slug)}/${encodeURIComponent(item.page_id)}?tab=read`,
    }))
    return acc
  }, {} as Record<string, { card: RankItemData; href: string }[]>)

  return (
    <>
      <div className="mb-3">
        <HomeTabBar />
      </div>
      <div className="grid gap-3">
      <SectionHead title="热门页面" />
      <VibenTabs defaultValue="热门页面">
        <VibenTabsList>
          {RANK_TABS.map((tab) => (
            <VibenTabsTrigger key={tab.key} value={tab.key}>{tab.key}</VibenTabsTrigger>
          ))}
        </VibenTabsList>
        {RANK_TABS.map((tab) => (
          <VibenTabsContent key={tab.key} value={tab.key} className="mt-2">
            {tabData[tab.key]?.length === 0 ? (
              <EmptyState tKey="community.noRankingData" fallback="暂无排行数据" />
            ) : (
              <div className="grid gap-2">
                {tabData[tab.key]?.map((item, i) => (
                  <RankItem key={i} data={item.card} href={item.href} />
                ))}
              </div>
            )}
          </VibenTabsContent>
        ))}
      </VibenTabs>
    </div>
    </>
  )
}
