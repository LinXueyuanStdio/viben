import { AuthorListClient } from "@/components/content/author-list-client"
import { db, users } from "@/lib/db"
import { desc } from "drizzle-orm"
import type { AuthorCardData } from "@/components/content/author-card"

const PAGE_SIZE = 24

export default async function AuthorListPage() {
  const rows = await db
    .select({
      id: users.id,
      userSlug: users.userSlug,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      followersCount: users.followersCount,
      pageCount: users.pageCount,
    })
    .from(users)
    .orderBy(desc(users.followersCount), desc(users.id))
    .limit(PAGE_SIZE + 1)

  const hasMore = rows.length > PAGE_SIZE
  const items = rows.slice(0, PAGE_SIZE)

  const initialCursor = hasMore
    ? Buffer.from(
        JSON.stringify({
          followers_count: items[items.length - 1].followersCount,
          id: items[items.length - 1].id,
        }),
        "utf8"
      ).toString("base64url")
    : null

  const initialAuthors: AuthorCardData[] = items.map((u) => ({
    fallbackText: u.displayName ?? u.userSlug,
    avatarUrl: u.avatarUrl ?? undefined,
    name: u.displayName,
    handle: `@${u.userSlug}`,
    userSlug: u.userSlug,
    description: u.bio ?? "",
    pageCount: u.pageCount ?? 0,
    followerCount: u.followersCount,
  }))

  return (
    <AuthorListClient
      initialAuthors={initialAuthors}
      initialHasMore={hasMore}
      initialCursor={initialCursor}
    />
  )
}
