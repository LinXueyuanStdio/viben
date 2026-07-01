import { after } from "next/server"
import { getPublishedPageContext, canReadPage, ensureCommunityEntityForPage, recordPageView } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { notFound, redirect } from "next/navigation"
import { ReadPageClient } from "@/components/pages/read-page-client"
import type { Metadata } from "next"

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

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  const activeTab = tab ?? "read"

  const [session, ctx] = await Promise.all([
    getSession(),
    getPublishedPageContext(user_slug, page_id),
  ])

  if (!ctx || !canReadPage(ctx.page, session)) notFound()

  const isAuthor = session?.userId === ctx.page.userId
  if (activeTab === "settings" && !isAuthor) {
    redirect(`/${encodeURIComponent(user_slug)}/${encodeURIComponent(page_id)}?tab=read`)
  }

  // 确保社区实体存在（评论需要）
  const communityEntity = await ensureCommunityEntityForPage(ctx)

  // 记录页面访问（fire-and-forget）
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
    <ReadPageClient
      userSlug={user_slug}
      pageId={page_id}
      pageHtml={ctx.page.html}
      pageTitle={ctx.page.title}
      pageDescription={ctx.page.description}
      pageUid={ctx.page.uid}
      pageViewCount={ctx.page.viewCount}
      pageLikeCount={ctx.page.likeCount}
      pageBookmarkCount={ctx.page.bookmarkCount}
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
      communityEntityId={communityEntity.id}
      pageDbId={ctx.page.id}
      pageCategoryId={ctx.page.categoryId}
      authorDbId={ctx.author.id}
      activeTab={activeTab}
      isAuthor={isAuthor}
    />
  )
}
