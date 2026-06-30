import { listMoments } from "@/lib/services/community"
import { getSession } from "@/lib/auth/cookies"
import { FeedCard } from "@/components/content/feed-card"
import type { FeedCardData } from "@/components/content/feed-card"
import { mapRichMomentToFeedCard } from "@/lib/services/moment-mapper"

export async function HomeFeedSection() {
  const session = await getSession()
  let feedItems: FeedCardData[] = []

  try {
    const momentsResult = await listMoments({ feedType: "recommended", session, limit: 5 })
    feedItems = momentsResult.items.map((item) => mapRichMomentToFeedCard(item))
  } catch (error) {
    console.error("[Home] Failed to fetch moments:", error)
  }

  if (feedItems.length === 0) return null

  return (
    <div className="grid gap-2">
      {feedItems.map((feed, i) => (
        <FeedCard key={i} data={feed} variant="preloaded" />
      ))}
    </div>
  )
}
