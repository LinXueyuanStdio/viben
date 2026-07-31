import { NextResponse } from "next/server"
import { db, users } from "@/lib/db"
import { desc, lt, or, and, eq } from "drizzle-orm"

/**
 * 获取作者列表
 * @summary 获取作者列表
 * @description 游标分页的创作者列表，按粉丝数降序排列。游标使用 base64url 编码，内部包含 followers_count 和 id，用于实现稳定的断点续传分页。每次查询取 limit+1 条记录，通过多余的一条判断是否还有更多数据。返回数据已做字段转换（snake_case 到 camelCase，部分字段重命名）以便前端直接使用。
 * @params AuthorsListQuery
 * @response 200:AuthorsListResponse:作者列表、下一页游标及是否有更多数据
 * @tag Authors
 */
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
