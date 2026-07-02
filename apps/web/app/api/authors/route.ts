import { NextResponse } from "next/server"
import { db, users } from "@/lib/db"
import { desc, lt, or, and, eq } from "drizzle-orm"

/** GET /api/authors — cursor-paginated author list */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 60)

  let cursorPredicate = undefined

  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
      if (typeof parsed.followers_count === "number" && typeof parsed.id === "string") {
        cursorPredicate = or(
          lt(users.followersCount, parsed.followers_count),
          and(
            eq(users.followersCount, parsed.followers_count),
            lt(users.id, parsed.id)
          )
        )
      }
    } catch {
      // invalid cursor, ignore
    }
  }

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
    .where(cursorPredicate)
    .orderBy(desc(users.followersCount), desc(users.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = rows.slice(0, limit)

  const nextCursor = hasMore
    ? Buffer.from(
        JSON.stringify({
          followers_count: items[items.length - 1].followersCount,
          id: items[items.length - 1].id,
        }),
        "utf8"
      ).toString("base64url")
    : null

  return NextResponse.json({
    items: items.map((u) => ({
      fallbackText: u.displayName ?? u.userSlug,
      avatarUrl: u.avatarUrl ?? null,
      name: u.displayName,
      handle: `@${u.userSlug}`,
      userSlug: u.userSlug,
      description: u.bio ?? "",
      pageCount: u.pageCount ?? 0,
      followerCount: u.followersCount,
    })),
    next_cursor: nextCursor,
    has_more: hasMore,
  })
}
