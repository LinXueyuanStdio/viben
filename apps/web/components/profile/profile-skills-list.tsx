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
  { value: "downloads", label: "最多下载" },
  { value: "popular", label: "最受欢迎" },
] as const

const VISIBILITY_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "public", label: "公开" },
  { value: "private", label: "私有" },
] as const

const PAGE_SIZE = 20

interface ProfileSkillsListProps {
  skills: (ProfileContentItemData & { id: string })[]
  total: number
}

export function ProfileSkillsList({ skills, total }: ProfileSkillsListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = Number(searchParams.get("skill_page") ?? 1)
  const currentSort = searchParams.get("skill_sort") ?? "latest"
  const currentVisibility = searchParams.get("skill_visibility") ?? "all"
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
    // Reset page when changing sort or visibility
    if ((updates.skill_sort !== undefined || updates.skill_visibility !== undefined) && !("skill_page" in updates)) {
      params.delete("skill_page")
    }
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const filtered = searchQuery.trim()
    ? skills.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : skills

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={currentVisibility}
          onValueChange={(value) => updateParams({ skill_visibility: value === "all" ? null : value })}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={currentSort}
          onValueChange={(value) => updateParams({ skill_sort: value === "latest" ? null : value })}
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
          <a href="/publish?type=skill">
            <Plus className="h-4 w-4" />
            创建技能
          </a>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState tKey="profile.noSkills" fallback="暂无发布的技能" />
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => (
            <ProfileContentItem
              key={item.id}
              data={item}
              href={`/skill-market/${item.id}`}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} paramKey="skill_page" />
        </div>
      )}
    </div>
  )
}
