import { Suspense } from "react"
import { SearchPageContent } from "@/components/search/search-page-content"
import { searchPages, getSearchFilterCounts, logSearchQuery, getPopularTags, getPopularPages } from "@/lib/services/search"
import { getSession } from "@/lib/auth/cookies"
import { timeAgo } from "@/lib/services/moment-mapper"
import { T } from "@/components/content/i18n-text"
import type { SearchFilter } from "@/lib/services/search"
import type { PageCardData } from "@/components/content/page-card"

interface SearchPageProps {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}

async function SearchContent({ searchParams }: SearchPageProps) {
  const { q, filter, page } = await searchParams
  const query = q ?? ""
  const session = await getSession()
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1)
  const limit = 20
  const offset = (pageNum - 1) * limit

  if (!query.trim()) {
    // 无查询时展示热门标签/页面
    const [popularTags, popularPages] = await Promise.all([
      getPopularTags(8),
      getPopularPages(4),
    ])
    return (
      <SearchPageContent
        query=""
        results={[]}
        resultUrls={[]}
        filters={[]}
        activeFilter={""}
        popularTags={popularTags}
        popularPages={popularPages}
      />
    )
  }

  // 将 URL filter 参数映射到内部 SearchFilter 类型
  const resolvedFilter: SearchFilter = (filter === "pages") ? "pages" : "all"

  const [pages, filterCounts] = await Promise.all([
    searchPages({ query, filter: resolvedFilter, limit, offset }),
    getSearchFilterCounts(query),
  ])

  // Log search query asynchronously (fire-and-forget)
  logSearchQuery(session?.userId ?? null, query, pages.length).catch((err) => {
    console.error("[Search] Failed to log search query:", err)
  })

  const results: PageCardData[] = pages.map((p) => ({
    coverUrl: p.coverUrl,
    title: p.title,
    description: p.snippet ? stripHtml(p.snippet) : (p.description ?? ""),
    author: {
      name: p.authorDisplayName || p.authorSlug,
      avatarUrl: p.authorAvatarUrl ?? undefined,
    },
    timeAgo: timeAgo(p.lastPublishedAt),
    stats: {
      views: p.viewCount,
      likes: p.likeCount,
      comments: p.commentCount,
      bookmarks: p.bookmarkCount,
    },
    isAuthenticated: !!session,
    pageDbId: p.id,
  }))

  const resultUrls = results.map((_, i) => `/${encodeURIComponent(pages[i].authorSlug)}/${pages[i].uid}?tab=read`)

  const filters = filterCounts.map((f) => ({
    label: f.label,
    count: f.count,
    value: f.value,
  }))

  const hasMore = offset + limit < (filterCounts.find(f => f.value === (resolvedFilter === "pages" ? "pages" : ""))?.count ?? 0)

  return (
    <SearchPageContent
      query={query}
      results={results}
      resultUrls={resultUrls}
      filters={filters}
      activeFilter={filter ?? ""}
      currentPage={pageNum}
      hasMore={hasMore}
    />
  )
}

/** 去除 HTML 标签，用于 snippet 纯文本展示 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

export default function SearchPage(props: SearchPageProps) {
  return (
    <Suspense fallback={<div className="min-h-[360px] flex items-center justify-center text-muted-foreground"><T tKey="community.searching" fallback="搜索中..." /></div>}>
      <SearchContent {...props} />
    </Suspense>
  )
}
