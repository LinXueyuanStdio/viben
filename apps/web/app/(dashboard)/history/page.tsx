import { HistoryItem } from "@/components/content/history-item"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { Pill } from "@/components/content/pill"
import { Bookmark, BookOpen } from "lucide-react"
import Link from "next/link"
import { getBrowseHistory, listCommunityFavorites } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import type { HistoryItemData, HistorySource } from "@/components/content/history-item"

const HISTORY_TABS = ["全部", "未读完", "今天"]

const SOURCE_MAP: Record<string, HistorySource> = {
  home: "首页",
  moment: "动态",
  leaderboard: "榜单",
  pdf: "PDF",
  search: "搜索",
  collection: "合集",
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

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [historyResult, favoritesResult] = await Promise.all([
    getBrowseHistory(session, 50),
    listCommunityFavorites({ session, entityType: "published_page", limit: 5, cursor: null }),
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
      cover: item.cover_url ? `url(${item.cover_url})` : gradientCover(item.title),
      title: item.title,
      author: item.author_name ?? "?",
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
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
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
                  <p className="py-8 text-center text-sm text-muted-foreground">暂无浏览记录</p>
                ) : (
                  filterItems(tab).map((item, i) => (
                    <HistoryItem
                      key={i}
                      data={item}
                      href={
                        rawItems[i]
                          ? `/read/${encodeURIComponent(rawItems[i].author_slug)}/${encodeURIComponent(rawItems[i].page_id)}`
                          : `/read/unknown/${i}`
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
            <div className="font-bold text-sm">收藏过的页面</div>
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
        <SectionHead title="阅读队列" actionLabel="整理" actionHref="/history" />
        <div className="grid gap-2">
          <div className="flex items-center gap-2.5 rounded-[10px] border border-border p-2.5">
            <BookOpen className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate">继续阅读</div>
              <div className="text-[12.5px] text-muted-foreground">
                {unreadCount} 篇未读完
              </div>
            </div>
            <Pill>{unreadCount}</Pill>
          </div>
        </div>
      </aside>
    </div>
  )
}
