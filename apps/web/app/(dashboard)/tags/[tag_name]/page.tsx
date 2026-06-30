import { PageCard } from "@/components/content/page-card"
import { SectionHead } from "@/components/content/section-head"
import { AuthorCard } from "@/components/content/author-card"
import { db, publishedPages, users } from "@/lib/db"
import { desc, eq, and, ne, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { EmptyState } from "@/components/content/i18n-text"
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

export default async function TagPage({ params }: { params: Promise<{ tag_name: string }> }) {
  const { tag_name } = await params
  const tag = decodeURIComponent(tag_name)
  const session = await getSession()

  const [pages, topAuthors, relatedTags] = await Promise.all([
    db.select({
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      coverUrl: publishedPages.coverUrl,
      authorName: publishedPages.authorName,
      authorAvatarUrl: publishedPages.authorAvatarUrl,
      lastPublishedAt: publishedPages.lastPublishedAt,
      viewCount: publishedPages.viewCount,
      likeCount: publishedPages.likeCount,
      commentCount: publishedPages.commentCount,
      favoriteCount: publishedPages.favoriteCount,
      userSlug: users.userSlug,
    }).from(publishedPages)
      .innerJoin(users, eq(users.id, publishedPages.userId))
      .where(and(
        eq(publishedPages.visibility, "public"),
        eq(publishedPages.moderationStatus, "approved"),
        sql`${publishedPages.tags} @> ${JSON.stringify([tag])}::jsonb`
      ))
      .orderBy(desc(publishedPages.lastPublishedAt))
      .limit(20),
    session?.userId
      ? db.select().from(users).where(ne(users.id, session.userId)).orderBy(desc(users.followersCount)).limit(3)
      : db.select().from(users).orderBy(desc(users.followersCount)).limit(3),
    // Get related tags: other tags that appear alongside this tag
    db.execute(sql`
      SELECT DISTINCT tag, COUNT(*) as cnt
      FROM published_pages, jsonb_array_elements_text(tags) as tag
      WHERE visibility = 'public' AND moderation_status = 'approved'
        AND tags @> ${JSON.stringify([tag])}::jsonb
        AND tag != ${tag}
      GROUP BY tag
      ORDER BY cnt DESC
      LIMIT 10
    `),
  ])

  const pageCards: { card: PageCardData; href: string }[] = pages.map((p) => ({
    card: {
      cover: p.coverUrl ? `url(${p.coverUrl})` : gradientCover(p.title),
      title: p.title,
      description: p.description ?? undefined,
      author: {
        name: p.authorName ?? "?",
        fallbackText: p.authorName?.[0] ?? "?",
        avatarUrl: p.authorAvatarUrl ?? undefined,
      },
      timeAgo: timeAgo(p.lastPublishedAt),
      stats: {
        views: p.viewCount,
        likes: p.likeCount,
        comments: p.commentCount,
        bookmarks: p.favoriteCount,
      },
    },
    href: `/read/${encodeURIComponent(p.userSlug)}/${encodeURIComponent(p.uid)}`,
  }))

  const authorCards: AuthorCardData[] = topAuthors.map((u) => ({
    fallbackText: u.displayName?.[0] ?? "?",
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  const relatedTagList = (relatedTags.rows as { tag: string; cnt: number }[]).filter(r => r.tag?.trim())

  return (
    <div className="grid gap-[14px] lg:grid-cols-[1fr_330px]">
      <div className="grid gap-3">
        <SectionHead title={`标签：${tag}`} />
        {pageCards.length === 0 ? (
          <EmptyState tKey="community.noResults" fallback={`没有找到标签"${tag}"相关的页面`} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {pageCards.map((item, i) => (
              <PageCard key={i} data={item.card} variant="default" href={item.href} />
            ))}
          </div>
        )}
      </div>
      <aside className="grid gap-3 content-start">
        {relatedTagList.length > 0 && (
          <div className="grid gap-2">
            <div className="font-bold text-sm">相关标签</div>
            <div className="flex flex-wrap gap-1.5">
              {relatedTagList.map((rt) => (
                <a
                  key={rt.tag}
                  href={`/tags/${encodeURIComponent(rt.tag)}`}
                  className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-[12.5px] min-h-[26px] px-2.5 whitespace-nowrap hover:bg-emerald-200 dark:hover:bg-emerald-900/50"
                >
                  {rt.tag}
                  <span className="ml-1 text-[11px] opacity-70">{rt.cnt}</span>
                </a>
              ))}
            </div>
          </div>
        )}
        <SectionHead title="推荐作者" />
        {authorCards.map((author, i) => (
          <AuthorCard key={i} data={author} currentUserSlug={session?.userSlug} />
        ))}
      </aside>
    </div>
  )
}
