import { NextResponse } from "next/server"
import { db, publishedPages } from "@/lib/db"
import { eq, and, count, gte } from "drizzle-orm"
import { sql } from "drizzle-orm"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  try {
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
