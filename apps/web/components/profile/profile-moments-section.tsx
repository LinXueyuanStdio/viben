import { db, moments } from "@/lib/db"
import { eq, desc, and } from "drizzle-orm"
import { FeedCard } from "@/components/content/feed-card"
import { EmptyState } from "@/components/content/i18n-text"
import type { FeedCardData } from "@/components/content/feed-card"
import { mapMomentRowToFeedCard } from "@/lib/services/moment-mapper"
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

  try {
    authorMoments = await db.select().from(moments)
      .where(and(
        eq(moments.authorUserId, userId),
        eq(moments.visibility, "public"),
        eq(moments.isDeleted, false)
      ))
      .orderBy(desc(moments.createdAt))
      .limit(10)
  } catch (error) {
    console.error("[Profile] Failed to fetch moments:", error)
  }

  if (authorMoments.length === 0) {
    return <EmptyState tKey="community.noMoments" fallback="暂无动态" />
  }

  const feedCards: FeedCardData[] = authorMoments.map((m) =>
    mapMomentRowToFeedCard(m, { displayName, userSlug, avatarUrl }),
  )

  return (
    <div className="grid gap-2">
      {feedCards.map((feed, i) => (
        <FeedCard key={i} data={feed} variant="rich" session={session} />
      ))}
    </div>
  )
}
