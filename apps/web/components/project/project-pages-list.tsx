"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Plus, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PageItem {
  pageId: string
  uid: string
  title: string
  description: string | null
  coverUrl: string | null
  authorSlug: string
  addedAt: string | Date
}

interface ProjectPagesListProps {
  teamSlug: string
  projectSlug: string
  pages: PageItem[]
  defaultPageId: string | null
  isPageManager: boolean
}

export function ProjectPagesList({
  teamSlug,
  projectSlug,
  pages,
  defaultPageId,
  isPageManager,
}: ProjectPagesListProps) {
  const { t } = useTranslation()
  const [selectedCoverId, setSelectedCoverId] = useState<string>(defaultPageId ?? "")
  const [saving, setSaving] = useState(false)

  const handleCoverChange = useCallback(
    async (pageId: string) => {
      setSelectedCoverId(pageId)
      setSaving(true)
      try {
        const res = await fetch(
          `/api/teams/${encodeURIComponent(teamSlug)}/projects/${encodeURIComponent(projectSlug)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              default_page_id: pageId || null,
            }),
          },
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed" }))
          throw new Error(err.error ?? "Failed to update cover page")
        }
        toast.success(t("project.pages.coverSaved"))
      } catch (e) {
        // 回退到之前的选择
        setSelectedCoverId(defaultPageId ?? "")
        toast.error(
          e instanceof Error ? e.message : t("project.pages.coverSaveFailed"),
        )
      } finally {
        setSaving(false)
      }
    },
    [teamSlug, projectSlug, defaultPageId, t],
  )

  return (
    <div className="space-y-4">
      {/* Cover page selector — 仅 page manager 可见，放第一行 */}
      {isPageManager && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {t("project.pages.coverTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("project.pages.coverHint")}
            </p>
          </div>
          <Select
            value={selectedCoverId}
            onValueChange={handleCoverChange}
            disabled={saving || pages.length === 0}
          >
            <SelectTrigger className="w-[200px] shrink-0">
              <SelectValue placeholder={t("project.pages.coverPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {pages.map((page) => (
                <SelectItem key={page.pageId} value={page.pageId}>
                  {page.title || page.uid}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {pages.length > 0
            ? t("project.pages.title", { count: pages.length })
            : t("project.tabs.pages")}
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link href={`/team/${teamSlug}/projects/${projectSlug}/new`}>
            <Plus className="h-4 w-4" />
            <span className="ml-1.5">{t("project.pages.createPage")}</span>
          </Link>
        </Button>
      </div>

      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
          <h3 className="text-lg font-medium">{t("project.pages.empty")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("project.pages.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.map((page) => (
            <Link
              key={page.pageId}
              href={`/${teamSlug}/${page.uid}?tab=read`}
              target="_blank"
            >
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-4">
                  <h3 className="font-semibold truncate">{page.title}</h3>
                  {page.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {page.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("project.pages.by", { author: page.authorSlug })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
