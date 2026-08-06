"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
}

export function ProjectPagesList({ teamSlug, projectSlug, pages }: ProjectPagesListProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
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
              href={`/${page.authorSlug}/${page.uid}?tab=read`}
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
