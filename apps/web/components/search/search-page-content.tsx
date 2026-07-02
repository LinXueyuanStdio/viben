"use client"

import { useTranslation } from "react-i18next"
import { useRouter, useSearchParams } from "next/navigation"
import { PageCard } from "@/components/content/page-card"
import { SearchFilterSidebar } from "./search-filter-sidebar"
import { SearchEmpty } from "./search-empty"
import { Button } from "@/components/ui/button"
import type { PageCardData } from "@/components/content/page-card"

interface SearchFilter {
  label: string
  count: number
  value: string
}

const EMPTY_TRIGGERS = ["不存在", "空", "无结果", "zzzz"]

interface SearchPageContentProps {
  query: string
  results: PageCardData[]
  resultUrls: string[]
  filters: SearchFilter[]
  activeFilter: string
  popularTags?: string[]
  popularPages?: Array<{ title: string; url: string; coverUrl: string | null }>
  currentPage?: number
  hasMore?: boolean
}

export function SearchPageContent({
  query,
  results,
  resultUrls,
  filters,
  activeFilter,
  popularTags,
  popularPages,
  currentPage = 1,
  hasMore,
}: SearchPageContentProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEmpty = EMPTY_TRIGGERS.includes(query.toLowerCase()) || (query.trim() && results.length === 0)

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page > 1) {
      params.set("page", String(page))
    } else {
      params.delete("page")
    }
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  if (!query.trim()) {
    return <SearchEmpty query="" popularTags={popularTags} popularPages={popularPages} />
  }

  if (isEmpty) {
    return <SearchEmpty query={query} popularTags={popularTags} popularPages={popularPages} />
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground font-bold">
          {t('community.searchResults', { query, count: results.length })}
        </p>
      </div>

      {filters.length > 0 && (
        <div className="flex items-center gap-2">
          <SearchFilterSidebar filters={filters} activeFilter={activeFilter} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {results.map((result, i) => (
          <PageCard key={result.pageDbId ?? i} data={result} href={resultUrls[i]} />
        ))}
      </div>

      {/* Pagination */}
      {hasMore !== undefined && (
        <div className="flex items-center justify-center gap-2 py-4">
          {currentPage > 1 && (
            <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)}>
              {t("community.previousPage", "上一页")}
            </Button>
          )}
          <span className="text-sm text-muted-foreground font-bold px-2">
            {t("community.pageN", { n: currentPage })}
          </span>
          {hasMore && (
            <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)}>
              {t("community.nextPage", "下一页")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
