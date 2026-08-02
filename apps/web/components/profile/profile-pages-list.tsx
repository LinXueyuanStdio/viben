"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/shared/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProfileContentItem, type ProfileContentItemData } from "./profile-content-item"
import { EmptyState } from "@/components/content/i18n-text"

const SORT_OPTIONS = [
  { value: "latest", label: "最新发布" },
  { value: "views", label: "最多浏览" },
  { value: "likes", label: "最多喜欢" },
] as const

const PAGE_SIZE = 20

interface ProfilePagesListProps {
  pages: (ProfileContentItemData & { pageUid: string })[]
  total: number
  userSlug: string
}

export function ProfilePagesList({ pages, total, userSlug }: ProfilePagesListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("page") ?? 1)
  const currentSort = searchParams.get("sort") ?? "latest"
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const [searchQuery, setSearchQuery] = useState("")

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    // Reset page when changing sort
    if (updates.sort !== undefined && !("page" in updates)) {
      params.delete("page")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  // Filter by search locally on current page results
  const filtered = searchQuery.trim()
    ? pages.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pages

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索页面..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={currentSort}
          onValueChange={(value) => updateParams({ sort: value === "latest" ? null : value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild>
          <a href="/pages/new">
            <Plus className="h-4 w-4" />
            创建页面
          </a>
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState tKey="community.noPages" fallback="暂无公开页面" />
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => (
            <ProfileContentItem
              key={item.pageUid}
              data={item}
              href={`/${encodeURIComponent(userSlug)}/${encodeURIComponent(item.pageUid)}?tab=read`}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  )
}
