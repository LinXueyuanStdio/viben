"use client"

import { useTranslation } from "react-i18next"
import { useRouter, useSearchParams } from "next/navigation"
import { SearchResultCard } from "./search-result-card"
import { SearchFilterSidebar } from "./search-filter-sidebar"
import { SearchEmpty } from "./search-empty"
import { Button } from "@/components/ui/button"
import type { SearchResultData } from "./search-result-card"

interface SearchFilter {
  label: string
  count: number
  value: string
}

const EMPTY_TRIGGERS = ["不存在", "空", "无结果", "zzzz"]

interface SearchPageContentProps {
  query: string
  results: SearchResultData[]
  filters: SearchFilter[]
  activeFilter: string
  /** 热门标签（无查询时展示） */
  popularTags?: string[]
  /** 热门页面（空结果时展示） */
  popularPages?: Array<{ title: string; url: string; coverUrl: string | null }>
  /** 当前页码（1-based） */
  currentPage?: number
  /** 总页数 */
  totalPages?: number
  /** 是否有更多结果 */
  hasMore?: boolean
}

export function SearchPageContent({
  query,
  results,
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

  // Pagination handler
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

      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        {filters.length > 0 && (
          <SearchFilterSidebar filters={filters} activeFilter={activeFilter} />
        )}
        <div className="grid gap-2">
          {results.map((result) => (
            <SearchResultCard key={result.id} data={result} />
          ))}

          {/* Pagination */}
          {hasMore !== undefined && (
            <div className="flex items-center justify-center gap-2 py-4">
              {currentPage > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                >
                  {t("community.previousPage", "上一页")}
                </Button>
              )}
              <span className="text-sm text-muted-foreground font-bold px-2">
                {t("community.pageN", { n: currentPage })}
              </span>
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                >
                  {t("community.nextPage", "下一页")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
