"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

interface PageItem {
  html: string
  title: string
}

interface ProjectOverviewProps {
  defaultPage: PageItem | null
  teamSlug: string
  projectSlug: string
}

export function ProjectOverview({ defaultPage, teamSlug, projectSlug }: ProjectOverviewProps) {
  const { t } = useTranslation()

  if (!defaultPage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg gap-4">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        <div>
          <h3 className="text-lg font-medium">{t("project.overview.empty")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("project.overview.emptyHint")}
          </p>
        </div>
        <Button asChild>
          <Link href={`/team/${teamSlug}/projects/${projectSlug}/new`}>
            {t("project.overview.createPage")}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <iframe
      title={defaultPage.title}
      srcDoc={defaultPage.html}
      sandbox="allow-scripts allow-same-origin"
      className="w-full border rounded-lg"
      style={{ minHeight: "60vh" }}
    />
  )
}
