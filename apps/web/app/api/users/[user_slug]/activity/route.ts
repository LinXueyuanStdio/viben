import { NextResponse } from "next/server"
import { db, publishedPages, users } from "@/lib/db"
import { eq, and, count, gte } from "drizzle-orm"
import { sql } from "drizzle-orm"

/**
 * 获取用户动态
 * @description 获取用户过去一年（365天）内公开发布且审核通过的页面数量统计，按日期分组并升序排列。仅统计 visibility=public 且 moderationStatus=approved 的页面。用户不存在时返回空 data 数组而不报 404。公开接口，无需登录。
 * @pathParams UserSlugParams
 * @response 200:UserActivityResponse:近一年每日发布统计，data 为 {date, count} 数组；用户不存在或查询失败时返回空数组
 * @tag Users
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ user_slug: string }> }
) {
  const { user_slug } = await params

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.userSlug, user_slug),
      columns: { id: true },
    })
    if (!user) return NextResponse.json({ data: [] })

    const userId = user.id

    const rows = await db
      .select({
        date: sql<string>`${publishedPages.publishedAt}::date`,
        count: count(),
      })
      .from(publishedPages)
      .where(and(
        eq(publishedPages.userId, userId),
        eq(publishedPages.moderationStatus, "approved"),
        eq(publishedPages.visibility, "public"),
        gte(publishedPages.publishedAt, new Date(Date.now() - 365 * 24 * 3600 * 1000))
      ))
      .groupBy(sql`${publishedPages.publishedAt}::date`)
      .orderBy(sql`${publishedPages.publishedAt}::date`)

    const data = rows.map((r) => ({
      date: String(r.date).split("T")[0],
      count: Number(r.count),
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Activity data query failed:", error)
    return NextResponse.json({ data: [] })
  }
}
