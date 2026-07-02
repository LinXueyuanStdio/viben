import { db, moments, momentAttachments } from "@/lib/db"
import { eq, desc, and, inArray } from "drizzle-orm"
import { FeedCard } from "@/components/content/feed-card"
import { EmptyState } from "@/components/content/i18n-text"
import type { FeedCardData } from "@/components/content/feed-card"
import { mapMomentRowToFeedCard, type MomentAttachmentData } from "@/lib/services/moment-mapper"
import type { FeedCardSession } from "@/components/content/feed-card"

interface ProfileMomentsProps {
  userId: string
  userSlug: string
  displayName: string | null
  avatarUrl: string | null
  session?: FeedCardSession | null
}

export async function ProfileMoments({ userId, userSlug, displayName, avatarUrl, session }: ProfileMomentsProps) {
  let authorMoments: typeof moments.$inferSelect[] = []
  let attachmentsMap = new Map<string, MomentAttachmentData[]>()

  try {
    authorMoments = await db.select().from(moments)
      .where(and(
        eq(moments.authorUserId, userId),
        eq(moments.visibility, "public"),
        eq(moments.isDeleted, false)
      ))
      .orderBy(desc(moments.createdAt))
      .limit(10)

    // Fetch attachments for these moments
    if (authorMoments.length > 0) {
      const momentIds = authorMoments.map((m) => m.id)
      const attachmentRows = await db.select({
        momentId: momentAttachments.momentId,
        coverUrl: momentAttachments.coverUrlSnapshot,
        title: momentAttachments.titleSnapshot,
        authorName: momentAttachments.authorNameSnapshot,
        viewCount: momentAttachments.viewCountSnapshot,
        commentCount: momentAttachments.commentCountSnapshot,
      })
        .from(momentAttachments)
        .where(inArray(momentAttachments.momentId, momentIds))
        .orderBy(momentAttachments.sortOrder)

      for (const a of attachmentRows) {
        const list = attachmentsMap.get(a.momentId) ?? []
        list.push({
          cover_url: a.coverUrl,
          title: a.title,
          author_name: a.authorName,
          view_count: a.viewCount,
          comment_count: a.commentCount,
        })
        attachmentsMap.set(a.momentId, list)
      }
    }
  } catch (error) {
    console.error("[Profile] Failed to fetch moments:", error)
  }

  if (authorMoments.length === 0) {
    return <EmptyState tKey="community.noMoments" fallback="暂无动态" />
  }

  const feedCards: FeedCardData[] = authorMoments.map((m) =>
    mapMomentRowToFeedCard(m, { displayName, userSlug, avatarUrl }, {
      attachments: attachmentsMap.get(m.id),
    }),
  )

  return (
    <div className="grid gap-2">
      {feedCards.map((feed, i) => (
        <FeedCard key={i} data={feed} variant="rich" session={session} />
      ))}
    </div>
  )
}
