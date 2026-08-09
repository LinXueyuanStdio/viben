import { db, moments, users, momentAttachments } from "@/lib/db"
import { eq, and, desc } from "drizzle-orm"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { ensureCommunityEntity, listCommunityComments, getCommunitySummary } from "@/lib/services/community"
import { MomentDetailClient } from "./client"
import type { Metadata } from "next"
import { mapRichMomentToFeedCard } from "@/lib/services/moment-mapper"
import type { MomentFeedItem } from "@/lib/services/community"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const moment = await db.query.moments.findFirst({
    where: and(eq(moments.id, id), eq(moments.isDeleted, false)),
    columns: { body: true },
  })
  const title = moment?.body?.slice(0, 60) ?? "动态详情"
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return {
    title: `${title} - Viben`,
    description: title,
    alternates: {
      canonical: `${APP_URL}/moment/${id}`,
    },
    openGraph: {
      title: `${title} - Viben`,
      description: title,
      url: `${APP_URL}/moment/${id}`,
      type: "article",
    },
  }
}

export default async function MomentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()

  const moment = await db.query.moments.findFirst({
    where: and(eq(moments.id, id), eq(moments.isDeleted, false), eq(moments.visibility, "public")),
  })
  if (!moment) notFound()

  const author = await db.query.users.findFirst({
    where: eq(users.id, moment.authorUserId),
    columns: { id: true, userSlug: true, displayName: true, avatarUrl: true },
  })
  if (!author) notFound()

  const attachments = await db.query.momentAttachments.findMany({
    where: eq(momentAttachments.momentId, moment.id),
    orderBy: [momentAttachments.sortOrder],
  })

  // Ensure community entity exists for commenting and interaction queries
  await ensureCommunityEntity("moment", moment.id)

  // Get viewer interaction state
  const summary = session
    ? await getCommunitySummary("moment", moment.id, session)
    : null

  // Initial comments
  const commentsResult = await listCommunityComments({
    entityType: "moment",
    entityId: moment.id,
    parentCommentId: null,
    limit: 20,
    session,
  })

  // Build MomentFeedItem for the mapper
  const feedItem: MomentFeedItem = {
    moment: {
      id: moment.id,
      uid: moment.uid,
      kind: moment.kind,
      body: moment.body,
      visibility: moment.visibility,
      like_count: moment.likeCount,
      comment_count: moment.commentCount,
      repost_count: moment.repostCount,
      created_at: moment.createdAt.toISOString(),
      source: moment.source,
      quote_text: moment.quoteText,
      view_count: moment.viewCount,
      bookmark_count: moment.bookmarkCount,
    },
    author: {
      id: author.id,
      user_slug: author.userSlug,
      display_name: author.displayName,
      avatar_url: author.avatarUrl,
    },
    attachments: attachments.map((a) => ({
      attachment_type: a.attachmentType,
      attachment_id: a.attachmentId,
      attachment_uid: a.attachmentUid,
      title: a.titleSnapshot,
      description: a.descriptionSnapshot,
      cover_url: a.coverUrlSnapshot,
      author_name_snapshot: a.authorNameSnapshot,
      view_count_snapshot: a.viewCountSnapshot,
      comment_count_snapshot: a.commentCountSnapshot,
    })),
    viewer_state: {
      is_authenticated: !!session,
      can_edit: session?.userId === moment.authorUserId,
      can_delete: session?.userId === moment.authorUserId,
      has_liked: summary?.viewer.has_reacted ?? false,
      has_bookmarked: summary?.viewer.has_bookmarked ?? false,
    },
    topics: [],
  }

  const feedCardData = mapRichMomentToFeedCard(feedItem)

  return (
    <MomentDetailClient
      feedData={feedCardData}
      momentId={moment.id}
      isAuthenticated={!!session}
      sessionUsername={session?.username}
      sessionAvatarUrl={session?.avatarUrl}
      sessionUserId={session?.userId}
      sessionUserSlug={session?.userSlug}
      initialComments={commentsResult.comments.map((c) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        updated_at: c.updated_at,
        depth: c.depth,
        parent_comment_id: null,
        replies_count: c.replies_count,
        reactions_count: c.reactions_count,
        viewer_has_reacted: c.viewer_has_reacted,
        author: {
          id: c.author.id,
          user_slug: c.author.user_slug,
          display_name: c.author.display_name,
          avatar_url: c.author.avatar_url,
        },
      }))}
      initialCommentsNextCursor={commentsResult.next_cursor}
    />
  )
}
