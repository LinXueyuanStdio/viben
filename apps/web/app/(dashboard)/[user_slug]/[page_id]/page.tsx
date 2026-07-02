import { after } from "next/server"
import { Suspense } from "react"
import { eq, and, ne, desc } from "drizzle-orm"
import { getPublishedPageContext, canReadPage, getCommunitySummary, ensureCommunityEntityForPage, recordPageView, listCommunityComments } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { db, publishedPages, users } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { ReadPageClient } from "@/components/pages/read-page-client"
import { ReadPageShell } from "@/components/pages/read-page-shell"
import type { Metadata } from "next"
import type { MiniPageCardData } from "@/components/content/mini-page-card"
import type { Session } from "@/lib/auth/types"

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
  const activeTab = tab ?? "read"
  const session = await getSession()

  // T1: Blocking — page context + permission check
  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx || !canReadPage(ctx.page, session)) {
    notFound()
  }

  // Settings tab: only available to the page author
  const isAuthor = session?.userId === ctx.page.userId
  if (activeTab === "settings" && !isAuthor) {
    redirect(`/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}?tab=read`)
  }

  // Ensure community entity exists (lightweight upsert, needed for ReadPageClient prop)
  const communityEntity = await ensureCommunityEntityForPage(ctx)

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

  return (
    <ReadPageShell
      userSlug={user_slug}
      pageId={page_id}
      hasSidePage={!!ctx.page.sidePageUid}
      activeTab={activeTab}
    >
      {/* Page meta for Topbar (read on client by window.__viben_page_meta via ReadPageShell) */}
      <script
        id="viben-page-meta"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            hasSidePage: !!ctx.page.sidePageUid,
            userSlug: user_slug,
            pageId: page_id,
            pageTitle: ctx.page.title,
            authorName: ctx.page.authorDisplayName ?? ctx.author.displayName,
            authorAvatarUrl: ctx.page.authorAvatarUrl ?? ctx.author.avatarUrl,
            pageDbId: ctx.page.id,
            communityEntityId: communityEntity.id,
            pageUid: ctx.page.uid,
            visibility: ctx.page.visibility,
          }),
        }}
      />

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
        authorDisplayName={ctx.author.displayName}
        authorAvatarUrl={ctx.author.avatarUrl}
        authorFollowersCount={ctx.author.followersCount}
        isAuthenticated={!!session}
        sessionUsername={session?.username}
        sessionAvatarUrl={session?.avatarUrl}
        sessionUserSlug={session?.userSlug}
        sessionUserId={session?.userId}
        communityEntityId={communityEntity.id}
        pageDbId={ctx.page.id}
        // T2/T3 data: defaults — real data streams via Suspense and is bridged
        // to the client via injected <script> tags. Phase 6 will switch
        // ReadPageClient to read from useScriptData instead of props.
        viewerHasReacted={false}
        viewerHasBookmarked={false}
        initialComments={[]}
        initialCommentsNextCursor={null}
        recommendationEntries={[]}
        activeTab={activeTab}
        isAuthor={isAuthor}
      />

      {/* T2: Community summary — streams after T1, doesn't block page render */}
      <Suspense fallback={null}>
        <CommunitySummaryInjector
          pageId={ctx.page.id}
          pageUid={ctx.page.uid}
          userSlug={ctx.author.userSlug}
          session={session}
        />
      </Suspense>

      {/* T3: Initial comments — streams after T2 */}
      <Suspense fallback={null}>
        <InitialCommentsInjector pageId={ctx.page.id} session={session} />
      </Suspense>

      {/* T3: Recommendations — streams after T2 */}
      <Suspense fallback={null}>
        <RecommendationsInjector
          pageId={ctx.page.id}
          categoryId={ctx.page.categoryId}
          authorUserId={ctx.author.id}
        />
      </Suspense>
    </ReadPageShell>
  )
}

// --- Async injector components (server-side, streamed via Suspense) ---

async function CommunitySummaryInjector({
  pageId,
  pageUid,
  userSlug,
  session,
}: {
  pageId: string
  pageUid: string
  userSlug: string
  session: Session | null
}) {
  const summary = await getCommunitySummary("published_page", pageId, session)

  // Ensure community entity exists for this page (idempotent upsert)
  let communityEntityId = pageId
  try {
    const entity = await ensureCommunityEntityForPage({
      page: { id: pageId, uid: pageUid, userId: session?.userId ?? "", visibility: "public", title: "" } as any,
      author: { userSlug } as any,
    })
    communityEntityId = entity.id
  } catch {
    // Silently fail — the page body already ensured the entity
  }

  return (
    <script
      id="viben-community-summary"
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          viewerHasReacted: summary?.viewer.has_reacted ?? false,
          viewerHasBookmarked: summary?.viewer.has_bookmarked ?? false,
          communityEntityId,
          likeCount: summary?.entity.reactions_count ?? 0,
          bookmarkCount: summary?.entity.bookmarks_count ?? 0,
        }),
      }}
    />
  )
}

async function InitialCommentsInjector({
  pageId,
  session,
}: {
  pageId: string
  session: Session | null
}) {
  const result = await listCommunityComments({
    entityType: "published_page",
    entityId: pageId,
    parentCommentId: null,
    limit: 20,
    session,
  })

  return (
    <script
      id="viben-initial-comments"
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          comments: result.comments,
          nextCursor: result.next_cursor,
        }),
      }}
    />
  )
}

async function RecommendationsInjector({
  pageId,
  categoryId,
  authorUserId,
}: {
  pageId: string
  categoryId: string | null
  authorUserId: string
}) {
  type RecEntry = { data: MiniPageCardData; href: string }
  let recommendationEntries: RecEntry[] = []

  try {
    const relatedRows = await db
      .select({
        uid: publishedPages.uid,
        title: publishedPages.title,
        description: publishedPages.description,
        authorDisplayName: publishedPages.authorDisplayName,
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
          ne(publishedPages.id, pageId),
          categoryId
            ? eq(publishedPages.categoryId, categoryId)
            : eq(publishedPages.userId, authorUserId)
        )
      )
      .orderBy(desc(publishedPages.viewCount))
      .limit(3)

    recommendationEntries = relatedRows.map((r) => ({
      data: {
        cover: r.coverUrl ? `url(${r.coverUrl})` : gradientCover(r.title),
        title: r.title,
        description: r.description ?? "",
        authorDisplayName: r.authorDisplayName ?? "?",
        authorAvatarUrl: r.authorAvatarUrl ?? undefined,
        authorFallbackText: r.authorDisplayName?.[0] ?? "?",
        commentCount: r.commentCount,
        stats: { views: r.viewCount, likes: r.likeCount },
      } satisfies MiniPageCardData,
      href: `/${encodeURIComponent(r.userSlug)}/${encodeURIComponent(r.uid)}?tab=read`,
    }))
  } catch {
    recommendationEntries = []
  }

  return (
    <script
      id="viben-recommendations"
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ recommendationEntries }),
      }}
    />
  )
}
