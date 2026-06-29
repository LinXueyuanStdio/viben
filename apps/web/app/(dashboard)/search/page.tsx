import { Suspense } from "react"
import { SearchPageContent } from "@/components/search/search-page-content"
import { searchPages, getSearchFilterCounts, logSearchQuery } from "@/lib/services/search"
import { getSession } from "@/lib/auth/cookies"
import { T } from "@/components/content/i18n-text"
import type { SearchResultData } from "@/components/search/search-result-card"

interface SearchPageProps {
  searchParams: Promise<{ q?: string; filter?: string }>
}

async function SearchContent({ searchParams }: SearchPageProps) {
  const { q, filter } = await searchParams
  const query = q ?? ""
  const session = await getSession()

  if (!query.trim()) {
    return <SearchPageContent query="" results={[]} filters={[]} activeFilter={filter ?? ""} />
  }

  const [pages, filterCounts] = await Promise.all([
    searchPages(query),
    getSearchFilterCounts(query),
  ])

  // Log search query asynchronously (fire-and-forget)
  logSearchQuery(session?.userId ?? null, query, pages.length).catch((err) => {
    console.error("[Search] Failed to log search query:", err)
  })

  const results: SearchResultData[] = pages.map((p) => ({
    id: p.id,
    type: "page" as const,
    title: p.title,
    description: p.description ?? "",
    author: { name: p.authorName ?? "?" },
    stats: {
      views: p.viewCount,
      likes: p.likeCount,
      comments: p.commentCount,
    },
    url: `/read/${p.userId ? encodeURIComponent(p.authorName ?? "") : ""}/${p.uid}`,
    coverUrl: p.coverUrl ?? undefined,
  }))

  const filters = filterCounts.map((f) => ({
    label: f.label,
    count: f.count,
    value: f.value,
  }))

  return (
    <SearchPageContent
      query={query}
      results={results}
      filters={filters}
      activeFilter={filter ?? ""}
    />
  )
}

export default function SearchPage(props: SearchPageProps) {
  return (
    <Suspense fallback={<div className="min-h-[360px] flex items-center justify-center text-muted-foreground"><T tKey="community.searching" fallback="搜索中..." /></div>}>
      <SearchContent {...props} />
    </Suspense>
  )
}
