import { HistoryItem } from "@/components/content/history-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { Pill } from "@/components/content/pill"
import { Bookmark, BookOpen } from "lucide-react"
import Link from "next/link"
import { getBrowseHistory, listCommunityBookmarks } from "@/lib/services/community"
import { EmptyState, T } from "@/components/content/i18n-text"
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { timeAgo } from "@/lib/services/moment-mapper"
import type { HistoryItemData, HistorySource } from "@/components/content/history-item"

export const dynamic = "force-dynamic"

const HISTORY_TABS = ["全部", "未读完", "今天"]

const SOURCE_MAP: Record<string, HistorySource> = {
  home: "首页",
  moment: "动态",
  leaderboard: "榜单",
  pdf: "PDF",
  search: "搜索",
  collection: "合集",
}

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [historyResult, favoritesResult] = await Promise.all([
    getBrowseHistory(session, 50),
    listCommunityBookmarks({ session, entityType: "published_page", limit: 5, cursor: null }),
  ])

  // Keep raw items for date-based filtering
  const rawItems = historyResult.items

  const allItems: HistoryItemData[] = rawItems.map((item) => {
    const progress =
      item.last_progress && typeof item.last_progress === "object"
        ? Number((item.last_progress as Record<string, unknown>).progress) || 0
        : 0
    const chapter =
      item.last_progress && typeof item.last_progress === "object"
        ? String((item.last_progress as Record<string, unknown>).chapter ?? "—")
        : "—"

    return {
      coverUrl: item.cover_url,
      title: item.title,
      author: item.author_display_name ?? "?",
      chapter,
      source: SOURCE_MAP[item.last_source ?? ""] ?? "首页",
      timeAgo: timeAgo(item.last_viewed_at),
      progress,
      progressLabel: progress >= 100 ? "已读完" : `已读 ${progress}%`,
    }
  })

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const filterItems = (tab: string): HistoryItemData[] => {
    if (tab === "全部") return allItems
    if (tab === "未读完")
      return allItems.filter(
        (item) => item.progress < 100
      )
    if (tab === "今天")
      return allItems.filter(
        (_, i) => new Date(rawItems[i].last_viewed_at) >= todayStart
      )
    return allItems
  }

  const bookmarkLinks =
    favoritesResult.items?.map((fav) => ({
      title: fav.title,
      href: fav.canonical_path ?? "/history",
    })) ?? []

  const unreadCount = allItems.filter((item) => item.progress < 100).length

  return (
    <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        <VibenTabs defaultValue="全部">
          <VibenTabsList>
            {HISTORY_TABS.map((tab) => (
              <VibenTabsTrigger key={tab} value={tab}>
                {tab}
              </VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {HISTORY_TABS.map((tab) => (
            <VibenTabsContent key={tab} value={tab} className="mt-2">
              <div className="grid gap-2">
                {filterItems(tab).length === 0 ? (
                  <EmptyState tKey="community.noHistory" fallback="暂无浏览记录" />
                ) : (
                  filterItems(tab).map((item, i) => (
                    <HistoryItem
                      key={i}
                      data={item}
                      href={
                        rawItems[i]
                          ? `/${encodeURIComponent(rawItems[i].author_slug)}/${encodeURIComponent(rawItems[i].page_id)}?tab=read`
                          : `/unknown/${i}?tab=read`
                      }
                    />
                  ))
                )}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-3 content-start">
        {bookmarkLinks.length > 0 && (
          <div className="grid gap-2">
            <div className="font-bold text-sm">
              <T tKey="community.bookmarkedPages" fallback="收藏过的页面" />
            </div>
            {bookmarkLinks.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <Bookmark className="size-3.5" />
                <span className="truncate">{link.title}</span>
              </Link>
            ))}
          </div>
        )}
        <SectionHead title="阅读队列" />
        <div className="rounded-[12px] border border-border bg-background overflow-hidden">
          <div className="flex items-center gap-3 p-3">
            <div className="flex items-center justify-center size-10 rounded-[10px] bg-primary/10 shrink-0">
              <BookOpen className="size-[18px] text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate">
                <T tKey="community.continueReading" fallback="继续阅读" />
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                {unreadCount} 篇未读完
              </div>
            </div>
            <Pill>{unreadCount}</Pill>
          </div>
          {unreadCount > 0 && (
            <div className="h-1.5 bg-surface-secondary">
              <div
                className="h-full bg-gradient-to-r from-primary to-[var(--color-cta,var(--color-primary))] rounded-r-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((unreadCount / (allItems.length || 1)) * 100))}%` }}
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
