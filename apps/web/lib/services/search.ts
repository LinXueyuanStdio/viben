import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db, publishedPages, moments, users, searchQueries } from "@/lib/db"

// ============================================
// 搜索筛选类型
// ============================================

export type SearchFilter = "all" | "pages" | "moments"

export interface SearchPageResult {
  id: string
  uid: string
  title: string
  description: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  authorSlug: string
  coverUrl: string | null
  viewCount: number
  likeCount: number
  commentCount: number
  bookmarkCount: number
  lastPublishedAt: Date
  /** 搜索结果片段（高亮上下文），仅全文搜索时有值 */
  snippet?: string
  /** 搜索相关性排名，仅全文搜索时有值 */
  searchRank?: number
}

export interface SearchMomentResult {
  id: string
  uid: string
  body: string | null
  authorUserId: string
  likeCount: number
  commentCount: number
  repostCount: number
  createdAt: Date
  authorName: string | null
  authorSlug: string
  authorAvatarUrl: string | null
  snippet?: string
  searchRank?: number
}

// ============================================
// 搜索日志
// ============================================

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

// ============================================
// 全文搜索辅助函数
// ============================================

/**
 * 检查 search_vector 列是否已存在（使用 PostgreSQL 全文搜索）
 * 如果列不存在则回退到 ilike
 */
async function hasSearchVector(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'published_pages' AND column_name = 'search_vector'
      ) as exists
    `)
    const row = result.rows[0] as { exists: boolean } | undefined
    return row?.exists ?? false
  } catch {
    return false
  }
}

// ============================================
// 搜索页面（带筛选 + 分页 + 全文搜索）
// ============================================

export interface SearchPagesOptions {
  query: string
  filter?: SearchFilter
  limit?: number
  offset?: number
}

/**
 * 全文搜索 publishedPages。
 * 优先使用 tsvector + ts_rank，fallback 到 ilike。
 */
export async function searchPages(options: SearchPagesOptions): Promise<SearchPageResult[]> {
  const { query, filter, limit = 50, offset = 0 } = options
  if (!query.trim()) return []

  const trimmedQuery = query.trim()

  // 如果请求的不是 all 也不是 pages，则返回空（调用方应调用对应的搜索函数）
  if (filter && filter !== "all" && filter !== "pages") return []

  const useTsVector = await hasSearchVector()

  if (useTsVector) {
    try {
      const tsquery = sql`websearch_to_tsquery('simple', ${trimmedQuery})`
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
          searchRank: sql<number>`ts_rank(${publishedPages}.search_vector, ${tsquery})`.as("search_rank"),
          snippet: sql<string>`ts_headline('simple', COALESCE(${publishedPages}.title, '') || ' ' || COALESCE(${publishedPages}.description, '') || ' ' || COALESCE(${publishedPages}.html, ''), ${tsquery}, 'MaxWords=30, MinWords=10, StartSel=<mark>, StopSel=</mark>')`.as("snippet"),
        })
        .from(publishedPages)
        .where(and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
          sql`${publishedPages}.search_vector @@ ${tsquery}`
        ))
        .orderBy(desc(sql`search_rank`))
        .limit(limit)
        .offset(offset)

      if (rows.length > 0) return rows
      // fall through to ilike if no tsvector results
    } catch {
      // fall through to ilike on error
    }
  }

  // ILIKE fallback
  const pattern = `%${trimmedQuery}%`
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
    .limit(limit)
    .offset(offset)
  return rows
}

// ============================================
// 搜索动态
// ============================================

export async function searchMoments(query: string, limit: number = 50, offset: number = 0): Promise<SearchMomentResult[]> {
  if (!query.trim()) return []
  const pattern = `%${query.trim()}%`
  const rows = await db
    .select({
      id: moments.id,
      uid: moments.uid,
      body: moments.body,
      authorUserId: moments.authorUserId,
      likeCount: moments.likeCount,
      commentCount: moments.commentCount,
      repostCount: moments.repostCount,
      createdAt: moments.createdAt,
      authorName: users.displayName,
      authorSlug: users.userSlug,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(moments)
    .innerJoin(users, eq(users.id, moments.authorUserId))
    .where(and(
      eq(moments.visibility, "public"),
      eq(moments.isDeleted, false),
      ilike(moments.body, pattern)
    ))
    .orderBy(desc(moments.createdAt))
    .limit(limit)
    .offset(offset)
  return rows
}

// ============================================
// 搜索筛选计数
// ============================================

export interface FilterCount {
  label: string
  count: number
  value: string
}

export async function getSearchFilterCounts(query: string): Promise<FilterCount[]> {
  if (!query.trim()) return [
    { label: "全部结果", count: 0, value: "" },
    { label: "页面", count: 0, value: "pages" },
  ]

  const pattern = `%${query.trim()}%`

  // Count pages matching the query
  const [pageCountResult] = await db
    .select({ count: count(publishedPages.id) })
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

  const pageCount = Number(pageCountResult?.count ?? 0)

  // Count moments matching the query
  const [momentCountResult] = await db
    .select({ count: count(moments.id) })
    .from(moments)
    .where(and(
      eq(moments.visibility, "public"),
      eq(moments.isDeleted, false),
      ilike(moments.body, pattern)
    ))

  const momentCount = Number(momentCountResult?.count ?? 0)
  const totalCount = pageCount + momentCount

  return [
    { label: "全部结果", count: totalCount, value: "" },
    { label: "页面", count: pageCount, value: "pages" },
  ]
}

// ============================================
// 热门标签（用于空结果推荐）
// ============================================

export async function getPopularTags(limit: number = 8): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT tag, COUNT(*) as cnt
    FROM published_pages, jsonb_array_elements_text(tags) as tag
    WHERE visibility = 'public' AND moderation_status = 'approved'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT ${limit}
  `)
  return (rows.rows as { tag: string }[]).map((r) => r.tag)
}

/** 获取热门页面（用于空结果推荐） */
export async function getPopularPages(limit: number = 4) {
  const rows = await db
    .select({
      title: publishedPages.title,
      authorSlug: publishedPages.authorSlug,
      uid: publishedPages.uid,
      coverUrl: publishedPages.coverUrl,
    })
    .from(publishedPages)
    .where(and(
      eq(publishedPages.visibility, "public"),
      eq(publishedPages.moderationStatus, "approved"),
    ))
    .orderBy(desc(publishedPages.viewCount))
    .limit(limit)
  return rows.map((p) => ({
    title: p.title,
    url: `/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}?tab=read`,
    coverUrl: p.coverUrl,
  }))
}
