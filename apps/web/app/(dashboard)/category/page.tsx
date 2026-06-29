import { PageCard } from "@/components/content/page-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { db, publishedPages, pageCategories, users } from "@/lib/db"
import { eq, desc, and, asc } from "drizzle-orm"
import type { PageCardData } from "@/components/content/page-card"
import type { AuthorCardData } from "@/components/content/author-card"

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

export default async function CategoryPage() {
  const [categories, allPages, topAuthors] = await Promise.all([
    db.select().from(pageCategories).where(eq(pageCategories.isActive, true)).orderBy(asc(pageCategories.sortOrder)),
    db.select().from(publishedPages)
      .where(and(
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(publishedPages.lastPublishedAt))
      .limit(50),
    db.select().from(users).orderBy(desc(users.followersCount)).limit(3),
  ])

  const pagesByCategory: Record<string, PageCardData[]> = {}
  for (const page of allPages) {
    const catId = page.categoryId ?? "__uncategorized__"
    if (!pagesByCategory[catId]) pagesByCategory[catId] = []
    pagesByCategory[catId].push({
      cover: page.coverUrl ? `url(${page.coverUrl})` : gradientCover(page.title),
      title: page.title,
      description: page.description ?? undefined,
      author: {
        name: page.authorName ?? "?",
        fallbackText: page.authorName?.[0] ?? "?",
        avatarUrl: page.authorAvatarUrl ?? undefined,
      },
      timeAgo: timeAgo(page.lastPublishedAt),
      stats: {
        views: page.viewCount,
        likes: page.likeCount,
        comments: page.commentCount,
        bookmarks: page.favoriteCount,
      },
    })
  }

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName?.[0] ?? "?",
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <div className="grid gap-[14px]" style={{ gridTemplateColumns: "minmax(0, 1fr) 330px" }}>
      <div className="grid gap-3">
        <VibenTabs defaultValue={categories[0]?.slug ?? ""}>
          <VibenTabsList>
            {categories.map((cat) => (
              <VibenTabsTrigger key={cat.slug} value={cat.slug}>{cat.name}</VibenTabsTrigger>
            ))}
          </VibenTabsList>
          {categories.map((cat) => (
            <VibenTabsContent key={cat.slug} value={cat.slug}>
              <SectionHead title={cat.name} actionLabel="换一换" actionHref="/category" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                {(pagesByCategory[cat.id] ?? pagesByCategory.__uncategorized__ ?? []).slice(0, 4).map((page, i) => (
                  <PageCard key={i} data={page} variant="default" href={`/read/${encodeURIComponent(page.author.name)}/${i}`} />
                ))}
              </div>
            </VibenTabsContent>
          ))}
        </VibenTabs>
      </div>
      <aside className="grid gap-2 content-start">
        <SectionHead title="相关作者" />
        {authorCards.map((author, i) => (
          <AuthorCard key={i} data={author} />
        ))}
      </aside>
    </div>
  )
}
