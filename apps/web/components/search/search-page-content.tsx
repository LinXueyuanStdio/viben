"use client"

import { useTranslation } from "react-i18next"
import { SearchResultCard } from "./search-result-card"
import { SearchFilterSidebar } from "./search-filter-sidebar"
import { SearchEmpty } from "./search-empty"
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
}

export function SearchPageContent({ query, results, filters, activeFilter }: SearchPageContentProps) {
  const { t } = useTranslation()
  const isEmpty = EMPTY_TRIGGERS.includes(query.toLowerCase()) || results.length === 0

  if (isEmpty) {
    return <SearchEmpty query={query} />
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
        </div>
      </div>
    </div>
  )
}
