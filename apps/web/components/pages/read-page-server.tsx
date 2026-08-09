import { after } from "next/server"
import { Suspense } from "react"
import { getCachedPublishedPageContext, canReadPage, getCommunitySummary, getCachedCommunityEntityId, recordPageView, listCommunityComments, getReadPageRecommendations } from "@/lib/services/community"
import { notFound, redirect } from "next/navigation"
import { db, users } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { ReadPageClient } from "@/components/pages/read-page-client"
import { ReadPageShell } from "@/components/pages/read-page-shell"
import type { Metadata } from "next"
import { makeOG, makeTwitter, APP_URL } from "@/lib/metadata"
import type { MiniPageCardData } from "@/components/content/mini-page-card"
import type { Session } from "@/lib/auth/types"

/** JSON 序列化安全 */
function iso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined
  return typeof d === "string" ? d : (d as Date).toISOString()
}

// ---- generateMetadata ----

export async function generateReadPageMetadata(
  userSlug: string,
  pageId: string,
  segmentsPath?: string,
): Promise<Metadata> {
  const ctx = await getCachedPublishedPageContext(userSlug, pageId)
  if (!ctx) return { title: "页面未找到" }

  const encodedSlug = encodeURIComponent(userSlug)
  const encodedPage = segmentsPath ?? encodeURIComponent(pageId)
  const seoTitle = ctx.page.seoTitle ?? ctx.page.title
  const seoDescription = ctx.page.seoDescription ?? ctx.page.description ?? `${ctx.author.displayName ?? ctx.author.userSlug} 分享的页面`
  const ogImage = ctx.page.coverUrl ?? ctx.author.avatarUrl
  const title = `${seoTitle} - Viben`

  return {
    title,
    description: seoDescription,
    keywords: ctx.page.seoKeywords ?? undefined,
    alternates: {
      canonical: `${APP_URL}/${encodedSlug}/${encodedPage}`,
    },
    robots: ctx.page.isDiscoverable === false
      ? { index: false, follow: false }
      : { index: true, follow: true },
    other: {
      "link:alternate": `<${APP_URL}/api/pages/raw/${encodedSlug}/${encodeURIComponent(pageId)}>; rel="alternate"; type="text/markdown"`,
    },
    openGraph: makeOG({
      title,
      url: `${APP_URL}/${encodedSlug}/${encodedPage}`,
      description: seoDescription,
      type: "article" as const,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    }),
    twitter: makeTwitter({
      title,
      description: seoDescription,
      card: ctx.page.coverUrl ? "summary_large_image" as const : "summary" as const,
      ...(ogImage ? { images: [ogImage] } : {}),
    }),
  }
}

// ---- ReadPageServer ----

interface ReadPageServerProps {
  userSlug: string
  pageId: string
  session: Session | null
  activeTab: string
  /** URL-encoded segments for canonical URL (catch-all routes pass this) */
  segmentsPath?: string
}

export async function ReadPageServer({ userSlug, pageId, session, activeTab, segmentsPath }: ReadPageServerProps) {
  const ctx = await getCachedPublishedPageContext(userSlug, pageId)
  if (!ctx || !canReadPage(ctx.page, session)) {
    notFound()
  }

  // 判断当前用户是否有编辑权限：
  // 1. 直接是页面作者（userId 匹配）
  // 2. 页面归属 team 且当前用户是 team member
  let isAuthor = session?.userId === ctx.page.userId
  if (!isAuthor && session?.userId) {
    const authorUser = await db.query.users.findFirst({
      where: eq(users.id, ctx.page.userId),
      columns: { type: true },
    })
    if (authorUser?.type === "team") {
      const { teamMembers } = await import("@/lib/db")
      const membership = await db.query.teamMembers.findFirst({
        where: and(eq(teamMembers.teamId, ctx.page.userId), eq(teamMembers.userId, session.userId)),
        columns: { role: true },
      })
      isAuthor = !!membership
    }
  }
  if (activeTab === "settings" && !isAuthor) {
    const encodedPage = segmentsPath ?? encodeURIComponent(pageId)
    redirect(`/${encodeURIComponent(userSlug)}/${encodedPage}?tab=read`)
  }

  const communityEntityId = await getCachedCommunityEntityId(ctx)

  after(async () => {
    try {
      await recordPageView({
        context: { page: ctx.page, author: ctx.author },
        session: session as any,
        source: "read_shell",
        route: `/${userSlug}/${pageId}`,
      })
    } catch (error) {
      console.error("Failed to record page view:", error)
    }
  })

  const encodedSlug = encodeURIComponent(userSlug)
  const encodedPage = segmentsPath ?? encodeURIComponent(pageId)
  const pageUrl = `${APP_URL}/${encodedSlug}/${encodedPage}`

  return (
    <ReadPageShell
      userSlug={userSlug}
      pageId={pageId}
      hasSidePage={!!ctx.page.sidePageUid}
      isPageManager={isAuthor}
      activeTab={activeTab}
    >
      {/* JSON-LD */}
      <script
        id="viben-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                "@id": `${pageUrl}#article`,
                headline: ctx.page.title,
                description: ctx.page.description,
                ...(ctx.page.coverUrl ? { image: ctx.page.coverUrl } : {}),
                datePublished: iso(ctx.page.publishedAt),
                dateModified: iso(ctx.page.lastPublishedAt),
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
                url: pageUrl,
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

      {/* Page meta for Topbar */}
      <script
        id="viben-page-meta"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            hasSidePage: !!ctx.page.sidePageUid,
            isPageManager: isAuthor,
            userSlug,
            pageId,
            pageTitle: ctx.page.title,
            authorName: ctx.page.authorDisplayName ?? ctx.author.displayName,
            authorAvatarUrl: ctx.page.authorAvatarUrl ?? ctx.author.avatarUrl,
            pageDbId: ctx.page.id,
            communityEntityId,
            pageUid: ctx.page.uid,
            visibility: ctx.page.visibility,
          }),
        }}
      />

      <ReadPageClient
        userSlug={userSlug}
        pageId={pageId}
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
        communityEntityId={communityEntityId}
        pageDbId={ctx.page.id}
        viewerHasReacted={false}
        viewerHasBookmarked={false}
        initialComments={[]}
        initialCommentsNextCursor={null}
        recommendationEntries={[]}
        activeTab={activeTab}
        isAuthor={isAuthor}
      />

      <Suspense fallback={null}>
        <CommunitySummaryInjector
          pageId={ctx.page.id}
          communityEntityId={communityEntityId}
          session={session}
        />
      </Suspense>

      <Suspense fallback={null}>
        <InitialCommentsInjector pageId={ctx.page.id} session={session} />
      </Suspense>

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

// ---- Async injector components ----

async function CommunitySummaryInjector({
  pageId,
  communityEntityId,
  session,
}: {
  pageId: string
  communityEntityId: string
  session: Session | null
}) {
  const summary = await getCommunitySummary("published_page", pageId, session)
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
    const relatedRows = await getReadPageRecommendations(pageId, categoryId, authorUserId)
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
