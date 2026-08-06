"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Search, Check, FileText } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils/index"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SwitcherChevron } from "./switcher-chevron"

interface PageItem {
  uid: string
  title: string
  authorSlug: string
}

interface PageSwitcherPopoverProps {
  userSlug: string
  currentPageId: string
  groupHovered?: boolean
}

export function PageSwitcherPopover({
  userSlug,
  currentPageId,
  groupHovered = false,
}: PageSwitcherPopoverProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selfHovered, setSelfHovered] = useState(false)
  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  const fetchPages = useCallback(
    async (query?: string) => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(false)
      try {
        const params = new URLSearchParams({ author_slug: userSlug })
        if (query) params.set("q", query)
        const res = await fetch(`/api/pages/search?${params}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setPages(data.pages ?? [])
        } else {
          setError(true)
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(true)
        }
      } finally {
        setLoading(false)
      }
    },
    [userSlug]
  )

  // 打开时获取页面列表
  useEffect(() => {
    if (open) {
      fetchPages(search || undefined)
    } else {
      setSearch("")
    }
  }, [open])

  // 搜索 debounce 300ms
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => fetchPages(search || undefined), 300)
    return () => clearTimeout(timer)
  }, [search, open, fetchPages])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SwitcherChevron
          groupHovered={groupHovered}
          selfHovered={selfHovered}
          onMouseEnter={() => setSelfHovered(true)}
          onMouseLeave={() => setSelfHovered(false)}
          aria-label={t("community.switchPage")}
        />
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(280px,calc(100vw-28px))] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-sm font-extrabold">{t("community.switchPage")}</p>
        </div>
        <div className="px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("community.searchPage")}
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[260px]">
          <div className="p-1">
            {loading && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t("common.loading")}
              </p>
            )}
            {!loading && error && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t("common.loadFailed")}
              </p>
            )}
            {!loading && !error && pages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {search ? t("community.noMatchPage") : t("community.noOtherPage")}
              </p>
            )}
            {!loading &&
              !error &&
              pages.map((page) => (
                <Link
                  key={page.uid}
                  href={`/${encodeURIComponent(userSlug)}/${encodeURIComponent(page.uid)}?tab=read`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-[9px] px-2 py-1.5 min-h-[34px] text-sm font-extrabold",
                    "hover:bg-surface-secondary",
                    page.uid === currentPageId
                      ? "bg-surface-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{page.title}</span>
                  {page.uid === currentPageId && (
                    <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
                  )}
                </Link>
              ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
