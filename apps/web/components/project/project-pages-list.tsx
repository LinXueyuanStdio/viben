"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"

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

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
        <h3 className="text-lg font-medium">{t("project.pages.empty")}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("project.pages.emptyHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("project.pages.title", { count: pages.length })}</h2>
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
    </div>
  )
}
