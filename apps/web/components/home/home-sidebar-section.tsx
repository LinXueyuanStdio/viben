import { AuthorCard } from "@/components/content/author-card"
import { Pill } from "@/components/content/pill"
import { Stat } from "@/components/content/stats-row"
import { SectionHead } from "@/components/content/section-head"
import { T } from "@/components/content/i18n-text"
import { Eye } from "lucide-react"
import type { AuthorCardData } from "@/components/content/author-card"

interface HomeSidebarSectionProps {
  authorCards: Array<{
    id: string
    userSlug: string
    displayName: string | null
    avatarUrl: string | null
    bio: string | null
    pageCount: number | null
    followersCount: number
  }>
  rankingPages: Array<{ title: string; stats: { views: number } }>
  sessionUserSlug?: string
}

export function HomeSidebarSection({ authorCards, rankingPages, sessionUserSlug }: HomeSidebarSectionProps) {
  const mappedAuthors: AuthorCardData[] = authorCards.map((u) => ({
    fallbackText: u.displayName ?? u.userSlug,
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName ?? u.userSlug,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <aside className="grid gap-3 content-start">
      {mappedAuthors.length > 0 && (
        <section>
          <SectionHead title="推荐关注" actionLabel={<T tKey="community.viewAll" fallback="查看全部" />} actionHref="/search" />
          <div className="grid gap-2">
            {mappedAuthors.map((author, i) => (
              <AuthorCard key={i} data={author} currentUserSlug={sessionUserSlug} />
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
