import { after } from "next/server"
import { eq, and, ne, desc } from "drizzle-orm"
import { getPublishedPageContext, canReadPage, getCommunitySummary, ensureCommunityEntityForPage, recordPageView } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { db, publishedPages } from "@/lib/db"
import { notFound } from "next/navigation"
import { ReadPageClient } from "./read-page-client"
import type { Metadata } from "next"
import type { MiniPageCardData } from "@/components/content/mini-page-card"

interface ReadPageProps {
  params: Promise<{ user_slug: string; page_id: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: ReadPageProps): Promise<Metadata> {
  const { user_slug, page_id } = await params
  const ctx = await getPublishedPageContext(user_slug, page_id)
  return {
    title: ctx ? `${ctx.page.title} - Viben` : "页面未找到",
    description: ctx?.page.description ?? "",
  }
}

function gradientCover(title: string): string {
  const hue = title.charCodeAt(0) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { user_slug, page_id } = await params
  const session = await getSession()

  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx || !canReadPage(ctx.page, session)) {
    notFound()
  }

  const summary = await getCommunitySummary("published_page", ctx.page.id, session)

  // Ensure community entity exists for comments
  const communityEntity = await ensureCommunityEntityForPage(ctx)

  // Record page view (fire-and-forget via after())
  after(async () => {
    try {
      await recordPageView({
        context: { page: ctx.page, author: ctx.author },
        session: session as any,
        source: "read_shell",
        route: `/read/${user_slug}/${page_id}`,
      })
    } catch (error) {
      console.error("Failed to record page view:", error)
    }
  })

  // Fetch recommendations (same category or same author pages)
  let recommendations: MiniPageCardData[] = []
  try {
    const relatedRows = await db
      .select({
        id: publishedPages.id,
        uid: publishedPages.uid,
        title: publishedPages.title,
        description: publishedPages.description,
        authorName: publishedPages.authorName,
        coverUrl: publishedPages.coverUrl,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        userId: publishedPages.userId,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
          ne(publishedPages.id, ctx.page.id),
          ctx.page.categoryId
            ? eq(publishedPages.categoryId, ctx.page.categoryId)
            : eq(publishedPages.userId, ctx.author.id)
        )
      )
      .orderBy(desc(publishedPages.viewCount))
      .limit(3)
    recommendations = relatedRows.map((r) => ({
      cover: r.coverUrl ? `url(${r.coverUrl})` : gradientCover(r.title),
      title: r.title,
      description: r.description ?? "",
      authorName: r.authorName ?? "?",
      stats: { views: r.viewCount, likes: r.likeCount },
    }))
  } catch {
    recommendations = []
  }

  return (
    <ReadPageClient
      userSlug={user_slug}
      pageId={page_id}
      pageHtml={ctx.page.html}
      pageTitle={ctx.page.title}
      pageDescription={ctx.page.description}
      pageUid={ctx.page.uid}
      pageViewCount={ctx.page.viewCount}
      pageFavoriteCount={ctx.page.favoriteCount}
      pageLikeCount={ctx.page.likeCount}
      pageCommentCount={ctx.page.commentCount}
      pageShareCount={ctx.page.shareCount}
      pagePublishedAt={ctx.page.publishedAt}
      pageTags={(ctx.page.tags as string[]) ?? []}
      pageCoverUrl={ctx.page.coverUrl ?? undefined}
      pageChaptersJson={ctx.page.chaptersJson ?? undefined}
      pageSidePageUid={ctx.page.sidePageUid ?? undefined}
      authorName={ctx.author.displayName}
      authorAvatarUrl={ctx.author.avatarUrl}
      authorFollowersCount={ctx.author.followersCount}
      isAuthenticated={!!session}
      sessionUsername={session?.username}
      sessionAvatarUrl={session?.avatarUrl}
      communityEntityId={communityEntity.id}
      recommendations={recommendations}
    />
  )
}
