import { after } from "next/server"
import { Suspense } from "react"
import { eq, and, ne, desc } from "drizzle-orm"
import { getPublishedPageContext, canReadPage, getCommunitySummary, ensureCommunityEntityForPage, recordPageView, listCommunityComments } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { db, publishedPages } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { ReadPageClient } from "@/components/pages/read-page-client"
import { ReadPageShell } from "@/components/pages/read-page-shell"
import type { Metadata } from "next"
import type { MiniPageCardData } from "@/components/content/mini-page-card"
import type { Session } from "@/lib/auth/types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

interface PageProps {
  params: Promise<{ user_slug: string; page_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_slug, page_id } = await params
  const ctx = await getPublishedPageContext(user_slug, page_id)

  if (!ctx) return { title: "页面未找到" }

  const seoTitle = ctx.page.seoTitle ?? ctx.page.title
  const seoDescription = ctx.page.seoDescription ?? ctx.page.description ?? `${ctx.author.displayName ?? ctx.author.userSlug} 分享的页面`
  const ogImage = ctx.page.coverUrl ?? ctx.author.avatarUrl

  const title = `${seoTitle} - Viben`

  const metadata: Metadata = {
    title,
    description: seoDescription,
    keywords: ctx.page.seoKeywords ?? undefined,
    alternates: {
      canonical: `${APP_URL}/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}`,
    },
    robots: ctx.page.isDiscoverable === false
      ? { index: false, follow: false }
      : { index: true, follow: true },
    other: {
      "link:alternate": `<${APP_URL}/api/pages/raw/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}>; rel="alternate"; type="text/markdown"`,
    },
    openGraph: {
      title,
      description: seoDescription,
      type: "article" as const,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: ctx.page.coverUrl ? "summary_large_image" as const : "summary" as const,
      title,
      description: seoDescription,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }

  return metadata
}

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  const activeTab = tab ?? "read"
  const session = await getSession()

  // T1: Blocking — page context + permission check
  const t_start = Date.now()
  const ctx = await getPublishedPageContext(user_slug, page_id)
  const t_t1 = Date.now()
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

  after(async () => {
    console.log("[perf] page_server", JSON.stringify({
      t1_ms: t_t1 - t_start,
      page_id: `${user_slug}/${page_id}`,
      is_public: ctx.page.visibility === "public",
      has_side_page: !!ctx.page.sidePageUid,
    }))
  })

  return (
    <ReadPageShell
      userSlug={user_slug}
      pageId={page_id}
      hasSidePage={!!ctx.page.sidePageUid}
      activeTab={activeTab}
    >
      {/* JSON-LD structured data for AI agents and search engines */}
      <script
        id="viben-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                "@id": `${APP_URL}/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}#article`,
                headline: ctx.page.title,
                description: ctx.page.description,
                ...(ctx.page.coverUrl ? { image: ctx.page.coverUrl } : {}),
                datePublished: ctx.page.publishedAt?.toISOString(),
                dateModified: ctx.page.lastPublishedAt?.toISOString(),
                author: {
                  "@type": "Person",
                  name: ctx.page.authorDisplayName ?? ctx.author.displayName,
                  url: `${APP_URL}/${encodeURIComponent(ctx.author.userSlug)}`,
                },
                publisher: {
                  "@type": "Organization",
                  name: "Viben",
                  url: APP_URL,
                },
                url: `${APP_URL}/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}`,
                ...(ctx.page.tags?.length ? { keywords: (ctx.page.tags as string[]).join(", ") } : {}),
                inLanguage: "zh-CN",
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Viben", item: APP_URL },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: ctx.page.authorDisplayName ?? ctx.author.displayName,
                    item: `${APP_URL}/${encodeURIComponent(ctx.author.userSlug)}`,
                  },
                  { "@type": "ListItem", position: 3, name: ctx.page.title },
                ],
              },
            ],
          }),
        }}
      />

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
        pageSeoTitle={ctx.page.seoTitle ?? null}
        pageSeoDescription={ctx.page.seoDescription ?? null}
        pageSeoKeywords={ctx.page.seoKeywords ?? null}
        pageIsDiscoverable={ctx.page.isDiscoverable}
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
        authorSlug: publishedPages.authorSlug,
        coverUrl: publishedPages.coverUrl,
        viewCount: publishedPages.viewCount,
        likeCount: publishedPages.likeCount,
        commentCount: publishedPages.commentCount,
      })
      .from(publishedPages)
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
        coverUrl: r.coverUrl,
        title: r.title,
        description: r.description ?? "",
        authorDisplayName: r.authorDisplayName || r.authorSlug,
        authorAvatarUrl: r.authorAvatarUrl ?? undefined,
        commentCount: r.commentCount,
        stats: { views: r.viewCount, likes: r.likeCount },
      } satisfies MiniPageCardData,
      href: `/${encodeURIComponent(r.authorSlug)}/${encodeURIComponent(r.uid)}?tab=read`,
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
