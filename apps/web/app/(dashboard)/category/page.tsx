import { PageCard } from "@/components/content/page-card"
import { AuthorCard } from "@/components/content/author-card"
import { SectionHead } from "@/components/content/section-head"
import { RefreshButton } from "@/components/content/refresh-button"
import { VibenTabs, VibenTabsList, VibenTabsTrigger, VibenTabsContent } from "@/components/ui/viben-tabs"
import { db, publishedPages, pageCategories, users } from "@/lib/db"
import { eq, desc, and, asc, ne } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { timeAgo } from "@/lib/services/moment-mapper"
import type { PageCardData } from "@/components/content/page-card"
import type { AuthorCardData } from "@/components/content/author-card"

interface PageResult {
  pageId: string
  authorSlug: string
  title: string
  description: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  coverUrl: string | null
  lastPublishedAt: Date | null
  viewCount: number
  likeCount: number
  commentCount: number
  bookmarkCount: number
  categoryId: string | null
}

export default async function CategoryPage() {
  const session = await getSession()

  const [categories, joinedPages, topAuthors] = await Promise.all([
    db.select().from(pageCategories).where(eq(pageCategories.isActive, true)).orderBy(asc(pageCategories.sortOrder)),
    db.select({
      pageId: publishedPages.uid,
      authorSlug: publishedPages.authorSlug,
      title: publishedPages.title,
      description: publishedPages.description,
      authorDisplayName: publishedPages.authorDisplayName,
      authorAvatarUrl: publishedPages.authorAvatarUrl,
      coverUrl: publishedPages.coverUrl,
      lastPublishedAt: publishedPages.lastPublishedAt,
      viewCount: publishedPages.viewCount,
      likeCount: publishedPages.likeCount,
      commentCount: publishedPages.commentCount,
      bookmarkCount: publishedPages.bookmarkCount,
      categoryId: publishedPages.categoryId,
    }).from(publishedPages)
      .where(and(
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved")
      ))
      .orderBy(desc(publishedPages.lastPublishedAt))
      .limit(50),
    session?.userId
      ? db.select({ id: users.id, userSlug: users.userSlug, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, pageCount: users.pageCount, followersCount: users.followersCount }).from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(3)
      : db.select({ id: users.id, userSlug: users.userSlug, displayName: users.displayName, avatarUrl: users.avatarUrl, bio: users.bio, pageCount: users.pageCount, followersCount: users.followersCount }).from(users).orderBy(desc(users.followersCount)).limit(3),
  ])

  const pagesByCategory: Record<string, { card: PageCardData; href: string }[]> = {}
  for (const row of joinedPages as PageResult[]) {
    const catId = row.categoryId ?? "__uncategorized__"
    if (!pagesByCategory[catId]) pagesByCategory[catId] = []
    pagesByCategory[catId].push({
      card: {
        coverUrl: row.coverUrl,
        title: row.title,
        description: row.description ?? undefined,
        author: {
          name: row.authorDisplayName || row.authorSlug,
          avatarUrl: row.authorAvatarUrl ?? undefined,
        },
        timeAgo: timeAgo(row.lastPublishedAt),
        stats: {
          views: row.viewCount,
          likes: row.likeCount,
          comments: row.commentCount,
          bookmarks: row.bookmarkCount,
        },
      },
      href: `/${encodeURIComponent(row.authorSlug)}/${encodeURIComponent(row.pageId)}?tab=read`,
    })
  }

  // Shuffle for variety on each render
  for (const key of Object.keys(pagesByCategory)) {
    pagesByCategory[key].sort(() => Math.random() - 0.5)
  }

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName ?? u.userSlug,
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  // If no categories exist, show all pages without tabs
  if (categories.length === 0) {
    return (
      <>
        <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
          <div className="grid gap-3">
            <SectionHead title="全部页面">
              <RefreshButton />
            </SectionHead>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(pagesByCategory["__uncategorized__"] ?? []).slice(0, 8).map((item, i) => (
                <PageCard key={i} data={item.card} variant="default" href={item.href} />
              ))}
            </div>
          </div>
          <aside className="grid gap-2 content-start">
            <SectionHead title="相关作者" />
            {authorCards.map((author, i) => (
              <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
            ))}
          </aside>
        </div>
      </>
    )
  }

  // Normal flow with categories
  return (
    <>
      <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_330px]">
        <div className="grid gap-3">
          <VibenTabs defaultValue={categories[0]?.slug ?? ""}>
            <VibenTabsList>
              {categories.map((cat) => (
                <VibenTabsTrigger key={cat.slug} value={cat.slug}>{cat.name}</VibenTabsTrigger>
              ))}
            </VibenTabsList>
            {categories.map((cat) => (
              <VibenTabsContent key={cat.slug} value={cat.slug}>
                <SectionHead title={cat.name}>
                  <RefreshButton />
                </SectionHead>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                  {(pagesByCategory[cat.id] ?? []).slice(0, 4).map((item, i) => (
                    <PageCard key={i} data={item.card} variant="default" href={item.href} />
                  ))}
                </div>
              </VibenTabsContent>
            ))}
          </VibenTabs>
        </div>
        <aside className="grid gap-2 content-start">
          <SectionHead title="相关作者" />
          {authorCards.map((author, i) => (
            <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
          ))}
        </aside>
      </div>
    </>
  )
}
