"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Search, X, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils/index"
import { ScrollArea } from "@/components/ui/scroll-area"

interface GlobalSearchProps {
  recentSearches: string[]
  onRemoveRecent?: (query: string) => void
  hotSearches: { query: string; count: number }[]
  onFocus?: () => void
}

export function GlobalSearch({
  recentSearches = [],
  onRemoveRecent,
  hotSearches = [],
  onFocus,
}: GlobalSearchProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const handleSearch = (q: string) => {
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      handleSearch(query.trim())
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[520px]">
      <div
        className={cn(
          "relative flex items-center gap-2 h-10 px-3 w-full",
          "border border-border rounded-[10px] bg-surface shadow-sm"
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { setOpen(true); onFocus?.() }}
          placeholder={t("community.searchPlaceholder")}
          className="flex-1 min-w-0 border-0 outline-none bg-transparent text-foreground font-inherit text-[15px] placeholder:text-muted-foreground truncate"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={t("community.clearSearch")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 w-full z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
        >
          <div className="grid gap-3">
            {/* 最近搜索 */}
            {recentSearches.length > 0 && (
              <div className="grid gap-2">
                <span className="text-xs font-black text-muted-foreground">{t("community.recentSearches")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 min-h-[28px] rounded-full bg-surface-secondary px-2.5 text-xs font-extrabold cursor-pointer hover:bg-surface"
                    >
                      <span onClick={() => handleSearch(item)}>{item}</span>
                      {onRemoveRecent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveRecent(item)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`删除 ${item}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 热门搜索 */}
            {hotSearches.length > 0 && (
              <div className="grid gap-1">
                <span className="text-xs font-black text-muted-foreground">{t("community.hotSearches")}</span>
                <ScrollArea className="max-h-[240px]">
                  <div className="grid gap-0.5">
                    {hotSearches.map((item, idx) => (
                      <button
                        key={item.query}
                        onClick={() => handleSearch(item.query)}
                        className="grid grid-cols-[22px_1fr_auto] items-center gap-2 min-h-[34px] rounded-lg px-2 text-left text-[13px] font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                      >
                        <span className={cn("text-center", idx < 3 && "text-primary")}>
                          {idx + 1}
                        </span>
                        <span className="truncate">{item.query}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.count.toLocaleString()} {t("community.searchCount")}
                          {idx === 0 && <TrendingUp className="inline h-3 w-3 ml-1 text-primary" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* 无数据 */}
            {recentSearches.length === 0 && hotSearches.length === 0 && (
              <div className="flex items-center justify-center min-h-[60px] text-sm font-extrabold text-muted-foreground">
                {t("community.noSearchSuggestions")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
