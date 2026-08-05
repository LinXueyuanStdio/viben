"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Search, X, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils/index"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppShell } from "./app-shell"

/**
 * 紧凑搜索触发按钮 + 搜索弹窗
 * - 放在 header 右侧，CreateDropdown 左边
 * - 显示 Search 图标 + "/" 键盘提示
 * - 点击或按 "/" 打开搜索弹窗
 */
export function SearchTrigger() {
  const { t } = useTranslation()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { session } = useAppShell()

  // 搜索数据：打开弹窗时才首次加载
  const { data: searchData, refetch: loadSearchData } = useQuery({
    queryKey: ["search-dialog-data", !!session],
    queryFn: async () => {
      const [hot, recent] = await Promise.all([
        fetch("/api/search/hot?limit=8").then(r => r.ok ? r.json() : []).catch(() => []),
        session
          ? fetch("/api/search/recent?limit=5").then(r => r.ok ? r.json() : []).catch(() => [])
          : Promise.resolve([]),
      ])
      return { hot: hot as Array<{ query: string; count: number }>, recent: recent as string[] }
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const hotSearches = searchData?.hot ?? []
  const recentSearches = searchData?.recent ?? []

  // 打开弹窗时加载数据并聚焦输入框
  const handleOpen = React.useCallback((open: boolean) => {
    setOpen(open)
    if (open) {
      setQuery("")
      loadSearchData()
      // 延迟聚焦，等 Dialog 动画完成
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loadSearchData])

  // 键盘快捷键 "/" 打开搜索
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 不在输入框中时，按 "/" 打开搜索
      if (e.key === "/" && !open) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
        e.preventDefault()
        handleOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, handleOpen])

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
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => handleOpen(true)}
        className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-secondary transition-colors"
        aria-label={t("community.searchPlaceholder")}
      >
        <Search className="size-[18px]" />
      </button>

      {/* 搜索弹窗 */}
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 top-[15%]">
          <DialogTitle className="sr-only">{t("community.searchPlaceholder")}</DialogTitle>
          <div className="flex flex-col">
            {/* 搜索输入框 — pr-12 为 DialogContent 默认关闭按钮留空间 */}
            <div className="flex items-center gap-2 h-12 pl-4 pr-12 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("community.searchPlaceholder")}
                className="flex-1 min-w-0 border-0 outline-none bg-transparent text-foreground text-[15px] placeholder:text-muted-foreground"
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
              {/* "/" 键盘提示 */}
              <kbd className="hidden sm:inline-flex items-center justify-center h-5 min-w-[20px] rounded border border-border bg-surface-secondary px-1 text-[10px] font-medium text-muted-foreground">
                /
              </kbd>
            </div>

            {/* 搜索建议 */}
            <div className="p-3">
              {/* 最近搜索 */}
              {recentSearches.length > 0 && (
                <div className="grid gap-2 mb-3">
                  <span className="text-xs font-black text-muted-foreground">{t("community.recentSearches")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((item) => (
                      <span
                        key={item}
                        onClick={() => handleSearch(item)}
                        className="inline-flex items-center min-h-[28px] rounded-full bg-surface-secondary px-2.5 text-xs font-extrabold cursor-pointer hover:bg-surface"
                      >
                        {item}
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
        </DialogContent>
      </Dialog>
    </>
  )
}
