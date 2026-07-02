import { PageCard } from "@/components/content/page-card"
import type { PageCardData } from "@/components/content/page-card"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { Bookmark } from "lucide-react"
import Link from "next/link"
import { getBrowseHistory, listCommunityBookmarks } from "@/lib/services/community"
import { EmptyState, T } from "@/components/content/i18n-text"
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { timeAgo } from "@/lib/services/moment-mapper"

export const dynamic = "force-dynamic"

const HISTORY_TABS = ["全部", "今天"]

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [historyResult, favoritesResult] = await Promise.all([
    getBrowseHistory(session, 50),
    listCommunityBookmarks({ session, entityType: "published_page", limit: 5, cursor: null }),
  ])

  const rawItems = historyResult.items

  const allItems: PageCardData[] = rawItems.map((item) => ({
    coverUrl: item.cover_url,
    title: item.title,
    description: item.description ?? undefined,
    author: {
      name: item.author_display_name ?? "?",
      avatarUrl: item.author_avatar_url ?? undefined,
    },
    timeAgo: timeAgo(item.last_viewed_at),
    stats: {
      views: item.stats?.views ?? 0,
      likes: item.stats?.likes ?? undefined,
      comments: item.stats?.comments ?? undefined,
      bookmarks: item.stats?.bookmarks ?? undefined,
    },
    isAuthenticated: true,
  }))

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const filterItems = (tab: string): PageCardData[] => {
    if (tab === "全部") return allItems
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
              <div className="grid gap-3 sm:grid-cols-2">
                {filterItems(tab).length === 0 ? (
                  <EmptyState tKey="community.noHistory" fallback="暂无浏览记录" />
                ) : (
                  filterItems(tab).map((item, i) => (
                    <PageCard
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
      </aside>
    </div>
  )
}
