import { after } from "next/server"
import { eq, and, ne, desc } from "drizzle-orm"
import { getPublishedPageContext, canReadPage, getCommunitySummary, ensureCommunityEntityForPage, recordPageView, listCommunityComments } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { db, publishedPages, users } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { ReadPageClient } from "@/components/pages/read-page-client"
import type { Metadata } from "next"
import type { MiniPageCardData } from "@/components/content/mini-page-card"

interface PageProps {
  params: Promise<{ user_slug: string; page_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_slug, page_id } = await params
  const ctx = await getPublishedPageContext(user_slug, page_id)

  if (!ctx) return { title: "页面未找到" }

  const title = `${ctx.page.title} - Viben`
  const description = ctx.page.description ?? `${ctx.author.displayName ?? ctx.author.userSlug} 分享的页面`
  const ogImage = ctx.page.coverUrl ?? ctx.author.avatarUrl

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article" as const,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: ctx.page.coverUrl ? "summary_large_image" as const : "summary" as const,
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

function gradientCover(title: string): string {
  const hue = title.charCodeAt(0) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
}

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  // 确保 URL 中始终有 tab 参数，以便 topbar 正确识别阅读模式
  if (!tab) {
    redirect(`/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}?tab=read`)
  }
  const activeTab = tab
  const session = await getSession()

  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx || !canReadPage(ctx.page, session)) {
    notFound()
  }

  // Settings tab: only available to the page author
  const isAuthor = session?.userId === ctx.page.userId
  if (activeTab === "settings" && !isAuthor) {
    redirect(`/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}?tab=read`)
  }

  const summary = await getCommunitySummary("published_page", ctx.page.id, session)
  const viewerHasReacted = summary?.viewer.has_reacted ?? false
  const viewerHasBookmarked = summary?.viewer.has_bookmarked ?? false

  // Ensure community entity exists for comments
  const communityEntity = await ensureCommunityEntityForPage(ctx)

  // Prefetch initial comments
  const initialComments = await listCommunityComments({
    entityType: "published_page",
    entityId: ctx.page.id,
    parentCommentId: null,
    limit: 20,
    session,
  })

  // Record page view (fire-and-forget via after())
  after(async () => {
    try {
      await recordPageView({
        context: { page: ctx.page, author: ctx.author },
        session: session as any,
        source: "read_shell",
        route: `/${user_slug}/${page_id}`,
      })
    } catch (error) {
      console.error("Failed to record page view:", error)
    }
  })

  // Fetch recommendations (same category or same author pages, with author detail)
  type RecEntry = { data: MiniPageCardData; href: string }
  let recommendationEntries: RecEntry[] = []
  try {
    const relatedRows = await db
      .select({
        uid: publishedPages.uid,
        title: publishedPages.title,
        description: publishedPages.description,
        authorName: publishedPages.authorName,
        authorAvatarUrl: publishedPages.authorAvatarUrl,
        coverUrl: publishedPages.coverUrl,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        commentCount: publishedPages.commentCount,
        userSlug: users.userSlug,
      })
      .from(publishedPages)
      .innerJoin(users, eq(users.id, publishedPages.userId))
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
    recommendationEntries = relatedRows.map((r) => ({
      data: {
        cover: r.coverUrl ? `url(${r.coverUrl})` : gradientCover(r.title),
        title: r.title,
        description: r.description ?? "",
        authorName: r.authorName ?? "?",
        authorAvatarUrl: r.authorAvatarUrl ?? undefined,
        authorFallbackText: r.authorName?.[0] ?? "?",
        commentCount: r.commentCount,
        stats: { views: r.viewCount, likes: r.likeCount },
      } satisfies MiniPageCardData,
      href: `/${encodeURIComponent(r.userSlug)}/${encodeURIComponent(r.uid)}?tab=read`,
    }))
  } catch {
    recommendationEntries = []
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
      pageBookmarkCount={ctx.page.bookmarkCount}
      pageLikeCount={ctx.page.likeCount}
      pageCommentCount={ctx.page.commentCount}
      pageShareCount={ctx.page.shareCount}
      pagePublishedAt={ctx.page.publishedAt}
      pageTags={(ctx.page.tags as string[]) ?? []}
      pageCoverUrl={ctx.page.coverUrl ?? undefined}
      pageChaptersJson={ctx.page.chaptersJson ?? undefined}
      pageSidePageUid={ctx.page.sidePageUid ?? undefined}
      pageVisibility={ctx.page.visibility}
      authorName={ctx.author.displayName}
      authorAvatarUrl={ctx.author.avatarUrl}
      authorFollowersCount={ctx.author.followersCount}
      isAuthenticated={!!session}
      sessionUsername={session?.username}
      sessionAvatarUrl={session?.avatarUrl}
      sessionUserSlug={session?.userSlug}
      sessionUserId={session?.userId}
      viewerHasReacted={viewerHasReacted}
      viewerHasBookmarked={viewerHasBookmarked}
      communityEntityId={communityEntity.id}
      pageDbId={ctx.page.id}
      initialComments={initialComments.comments}
      initialCommentsNextCursor={initialComments.next_cursor}
      recommendationEntries={recommendationEntries}
      activeTab={activeTab}
      isAuthor={isAuthor}
    />
  )
}
