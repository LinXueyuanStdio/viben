import { getPublishedPageContext, canReadPage, getCommunitySummary } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { ReadPageClient } from "./read-page-client"
import type { Metadata } from "next"

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

export default async function ReadPage({ params }: ReadPageProps) {
  const { user_slug, page_id } = await params
  const session = await getSession()

  const ctx = await getPublishedPageContext(user_slug, page_id)
  if (!ctx || !canReadPage(ctx.page, session)) {
    notFound()
  }

  const summary = await getCommunitySummary("published_page", ctx.page.id, session)

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
    />
  )
}
