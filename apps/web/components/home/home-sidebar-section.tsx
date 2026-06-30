import { db, users, publishedPages } from "@/lib/db"
import { desc, eq, ne, and } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { AuthorCard } from "@/components/content/author-card"
import { Pill } from "@/components/content/pill"
import { Stat } from "@/components/content/stats-row"
import { SectionHead } from "@/components/content/section-head"
import { T } from "@/components/content/i18n-text"
import { listRanking } from "@/lib/services/community"
import { Eye } from "lucide-react"
import type { AuthorCardData } from "@/components/content/author-card"

export async function HomeSidebarSection() {
  const session = await getSession()

  let authorCards: AuthorCardData[] = []
  let rankingPages: Array<{ title: string; stats: { views: number } }> = []

  try {
    const [topAuthors, rankingResult] = await Promise.all([
      session?.userId
        ? db.select().from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(3)
        : db.select().from(users).orderBy(desc(users.followersCount)).limit(3),
      listRanking({ rankingKey: "popular_pages", timeWindow: "7d", limit: 10 }),
    ])

    authorCards = topAuthors.map((u) => ({
      fallbackText: u.displayName?.[0] ?? "?",
      avatarUrl: u.avatarUrl ?? undefined,
      name: u.displayName ?? "?",
      handle: `@${u.userSlug}`,
      userSlug: u.userSlug,
      description: u.bio ?? "",
      pageCount: u.pageCount ?? 0,
      followerCount: u.followersCount,
    }))

    rankingPages = rankingResult.items.slice(0, 3).map((item) => ({
      title: item.title,
      stats: { views: item.view_count ?? 0 },
    }))
  } catch (error) {
    console.error("[Home] Failed to fetch sidebar data:", error)
  }

  return (
    <aside className="grid gap-3 content-start">
      {authorCards.length > 0 && (
        <section>
          <SectionHead title="推荐关注" actionLabel={<T tKey="community.viewAll" fallback="查看全部" />} actionHref="/search" />
          <div className="grid gap-2">
            {authorCards.map((author, i) => (
              <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
            ))}
          </div>
        </section>
      )}

      {rankingPages.length > 0 && (
        <section>
          <SectionHead title="本周上升" actionLabel={<T tKey="community.leaderboard" fallback="榜单" />} actionHref="/leaderboard" />
          <div className="grid gap-2">
            {rankingPages.map((page, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Pill variant="rank">{String(i + 1).padStart(2, "0")}</Pill>
                <span className="font-['Lexend'] text-[15px] font-bold truncate flex-1">{page.title}</span>
                <Stat icon={Eye} value={page.stats.views} format />
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
