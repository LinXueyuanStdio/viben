import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db, publishedPages, searchQueries } from "@/lib/db"

/** Log a search query */
export async function logSearchQuery(
  userId: string | null,
  query: string,
  resultCount: number = 0
) {
  if (!query.trim()) return
  await db.insert(searchQueries).values({
    userId,
    query: query.trim(),
    resultCount,
    searchedAt: new Date(),
  })
}

/** Get hot searches — aggregated from recent search_queries */
export async function getHotSearches(limit: number = 8) {
  const rows = await db
    .select({
      query: searchQueries.query,
      count: count(searchQueries.id).as("count"),
    })
    .from(searchQueries)
    .where(
      sql`${searchQueries.searchedAt} > now() - interval '7 days'`
    )
    .groupBy(searchQueries.query)
    .orderBy(desc(count(searchQueries.id)))
    .limit(limit)
  return rows.map((r) => ({ query: r.query, count: Number(r.count) }))
}

/** Get recent searches for a user */
export async function getRecentSearches(userId: string | null, limit: number = 5) {
  if (!userId) return []
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (query) query
    FROM search_queries
    WHERE user_id = ${userId}
    ORDER BY query, searched_at DESC
    LIMIT ${limit}
  `)
  return (rows.rows as { query: string }[]).map((r) => r.query)
}

/** Full-text search across published pages */
export async function searchPages(query: string) {
  if (!query.trim()) return []
  const pattern = `%${query.trim()}%`
  const rows = await db
    .select({
      id: publishedPages.id,
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      authorDisplayName: publishedPages.authorDisplayName,
      authorAvatarUrl: publishedPages.authorAvatarUrl,
      authorSlug: publishedPages.authorSlug,
      coverUrl: publishedPages.coverUrl,
      viewCount: publishedPages.viewCount,
      likeCount: publishedPages.likeCount,
      commentCount: publishedPages.commentCount,
      bookmarkCount: publishedPages.bookmarkCount,
      lastPublishedAt: publishedPages.lastPublishedAt,
    })
    .from(publishedPages)
    .where(and(
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved"),
      or(
        ilike(publishedPages.title, pattern),
        ilike(publishedPages.description, pattern),
        ilike(publishedPages.authorDisplayName, pattern),
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${publishedPages.tags}) as tag WHERE tag ILIKE ${pattern})`
      )
    ))
    .orderBy(desc(publishedPages.viewCount))
    .limit(50)
  return rows
}

/** Get search filter counts */
export async function getSearchFilterCounts(query: string) {
  if (!query.trim()) return []
  const pattern = `%${query.trim()}%`
  const pageCount = await db
    .select({ count: count(publishedPages.id) })
    .from(publishedPages)
    .where(and(
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved"),
      or(
        ilike(publishedPages.title, pattern),
        ilike(publishedPages.description, pattern)
      )
    ))
  return [
    { label: "全部结果", count: Number(pageCount[0]?.count ?? 0), value: "" },
    { label: "页面", count: Number(pageCount[0]?.count ?? 0), value: "page" },
  ]
}
