import { PageCard } from "@/components/content/page-card"
import type { PageCardData } from "@/components/content/page-card"
import { Bookmark } from "lucide-react"
import Link from "next/link"
import { getBrowseHistory, listCommunityBookmarks } from "@/lib/services/community"
import { EmptyState, T } from "@/components/content/i18n-text"
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { timeAgo } from "@/lib/services/moment-mapper"

export const dynamic = "force-dynamic"

interface HistorySection { label: string; items: PageCardData[]; hrefs: string[] }

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [historyResult, favoritesResult] = await Promise.all([
    getBrowseHistory(session, 80),
    listCommunityBookmarks({ session, entityType: "published_page", limit: 5, cursor: null }),
  ])

  const rawItems = historyResult.items

  // 时间分组
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000)

  const sections: HistorySection[] = [
    { label: "今天", items: [], hrefs: [] },
    { label: "昨天", items: [], hrefs: [] },
    { label: "本周", items: [], hrefs: [] },
    { label: "更早", items: [], hrefs: [] },
  ]

  rawItems.forEach((item) => {
    const d = new Date(item.last_viewed_at)
    const card: PageCardData = {
      coverUrl: item.cover_url,
      title: item.title,
      author: {
        name: item.author_display_name ?? "?",
      },
      timeAgo: timeAgo(item.last_viewed_at),
      stats: {
        views: item.stats?.views ?? 0,
        likes: item.stats?.likes ?? undefined,
        comments: item.stats?.comments ?? undefined,
        bookmarks: item.stats?.bookmarks ?? undefined,
      },
      isAuthenticated: true,
    }
    const href = `/${encodeURIComponent(item.author_slug)}/${encodeURIComponent(item.page_id)}?tab=read`

    if (d >= todayStart) {
      sections[0].items.push(card)
      sections[0].hrefs.push(href)
    } else if (d >= yesterdayStart) {
      sections[1].items.push(card)
      sections[1].hrefs.push(href)
    } else if (d >= weekStart) {
      sections[2].items.push(card)
      sections[2].hrefs.push(href)
    } else {
      sections[3].items.push(card)
      sections[3].hrefs.push(href)
    }
  })

  const visibleSections = sections.filter((s) => s.items.length > 0)

  const bookmarkLinks =
    favoritesResult.items?.map((fav) => ({
      title: fav.title,
      href: fav.canonical_path ?? "/history",
    })) ?? []

  return (
    <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        {visibleSections.length === 0 ? (
          <EmptyState tKey="community.noHistory" fallback="暂无浏览记录" />
        ) : (
          visibleSections.map((sec) => (
            <div key={sec.label} className="grid gap-2">
              <h2 className="font-['Lexend'] text-[17px] font-bold leading-[1.2] text-foreground">
                {sec.label}
              </h2>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {sec.items.map((item, i) => (
                  <PageCard
                    key={i}
                    data={item}
                    variant="home"
                    href={sec.hrefs[i]}
                    timeIcon
                  />
                ))}
              </div>
            </div>
          ))
        )}
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
      </aside>
    </div>
  )
}
