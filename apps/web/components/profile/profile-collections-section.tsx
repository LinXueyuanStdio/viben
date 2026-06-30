import { db, collections } from "@/lib/db"
import { eq, desc } from "drizzle-orm"
import { CollectionCard } from "@/components/collections/collection-card"
import { EmptyState } from "@/components/content/i18n-text"

interface ProfileCollectionsProps {
  userId: string
  username: string
  userSlug: string
  displayName: string | null
  avatarUrl: string | null
}

export async function ProfileCollections({ userId, username, userSlug, displayName, avatarUrl }: ProfileCollectionsProps) {
  let userCollections: typeof collections.$inferSelect[] = []

  try {
    userCollections = await db.select().from(collections)
      .where(eq(collections.ownerId, userId))
      .orderBy(desc(collections.updatedAt))
      .limit(10)
  } catch (error) {
    console.error("[Profile] Failed to fetch collections:", error)
  }

  if (userCollections.length === 0) {
    return <EmptyState tKey="community.noCollections" fallback="暂无创建的合集" />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {userCollections.map((c) => (
        <CollectionCard
          key={c.id}
          collection={{
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description ?? null,
            isPublic: c.isPublic,
            itemCount: c.itemCount,
            forksCount: c.forksCount,
            bookmarksCount: c.bookmarksCount,
            owner: {
              id: userId,
              username: username ?? userSlug,
              displayName: displayName ?? userSlug,
              avatarUrl: avatarUrl,
            },
          }}
          isOwner
        />
      ))}
    </div>
  )
}
