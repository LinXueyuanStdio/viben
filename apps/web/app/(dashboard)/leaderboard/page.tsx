"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { RankItem } from "@/components/content/rank-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { EmptyState } from "@/components/content/i18n-text"
import type { RankItemData } from "@/components/content/rank-item"

const RANK_TABS = [
  { key: "1d", label: "最新热度" },
  { key: "7d", label: "热门页面" },
  { key: "30d", label: "月度精选" },
] as const

const DEFAULT_TAB = "7d"
const STALE_TIME = 60 * 60 * 1000 // 1 小时，对齐 GitHub Action 刷新周期

async function fetchRanking(timeWindow: string) {
  const res = await fetch(`/api/leaderboard?timeWindow=${timeWindow}`)
  if (!res.ok) throw new Error("Failed to fetch")
  const data = await res.json()
  return (data.items ?? []).map((item: Record<string, unknown>) => {
    const d = item as any
    return {
      card: {
        rank: d.rank,
        coverUrl: d.cover_url,
        title: d.title,
        description: d.description ?? "",
        delta: d.delta ?? "—",
        author: {
          name: d.author_display_name ?? d.user_slug,
          avatarUrl: d.author_avatar_url ?? undefined,
        },
        stats: {
          views: d.view_count ?? 0,
          likes: d.like_count ?? 0,
          comments: d.comment_count ?? 0,
        },
        score: Math.round(d.score),
        scoreLabel: d.score_label ?? "热度",
      } satisfies RankItemData,
      href: `/${encodeURIComponent(d.user_slug)}/${encodeURIComponent(d.page_id)}?tab=read`,
    }
  }) as { card: RankItemData; href: string }[]
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["leaderboard", activeTab],
    queryFn: () => fetchRanking(activeTab),
    staleTime: STALE_TIME,
  })

  return (
    <>
      <div className="grid gap-3">
      <SectionHead title="热门页面" />
      <VibenTabs defaultValue={DEFAULT_TAB} onValueChange={setActiveTab}>
        <VibenTabsList variant="underline" className="gap-5">
          {RANK_TABS.map((tab) => (
            <VibenTabsTrigger key={tab.key} value={tab.key}>{tab.label}</VibenTabsTrigger>
          ))}
        </VibenTabsList>
        {RANK_TABS.map((tab) => (
          <VibenTabsContent key={tab.key} value={tab.key} className="mt-2">
            {activeTab !== tab.key ? null : isLoading ? (
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState tKey="community.noRankingData" fallback="暂无排行数据" />
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {items.map((item, i) => (
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
