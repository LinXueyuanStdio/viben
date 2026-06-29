import { RankItem } from "@/components/content/rank-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { listRanking } from "@/lib/services/community"
import { EmptyState } from "@/components/content/i18n-text"
import type { RankItemData } from "@/components/content/rank-item"

const RANK_TABS = [
  { key: "热门页面", timeWindow: "7d" },
  { key: "新近上升", timeWindow: "24h" },
  { key: "30天", timeWindow: "30d" },
]

function gradientCover(title: string): string {
  const hue = title.charCodeAt(0) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
}

export default async function LeaderboardPage() {
  // Fetch all 3 rankings in parallel
  const rankings = await Promise.all(
    RANK_TABS.map((tab) =>
      listRanking({ rankingKey: "popular_pages", timeWindow: tab.timeWindow, limit: 20 })
    )
  )

  const tabData = RANK_TABS.reduce((acc, tab, i) => {
    const rawItems = rankings[i]?.items ?? []
    acc[tab.key] = rawItems.map((item) => ({
      card: {
        rank: item.rank,
        cover: gradientCover(item.title),
        title: item.title,
        description: item.description ?? "",
        delta: item.delta ?? "—",
        author: {
          name: item.author_name ?? item.user_slug ?? "?",
          fallbackText: (item.author_name ?? item.user_slug)?.[0] ?? "?",
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
      href: `/read/${encodeURIComponent(item.user_slug)}/${encodeURIComponent(item.page_id)}`,
    }))
    return acc
  }, {} as Record<string, { card: RankItemData; href: string }[]>)

  return (
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
  )
}
