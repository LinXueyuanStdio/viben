"use client"

import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProjectSettingsLoaderProps {
  projectSlug: string
  teamSlug: string
  description: string | null
  createdBy: string
}

export function ProjectSettingsLoader({
  projectSlug, teamSlug, description, createdBy,
}: ProjectSettingsLoaderProps) {
  const { t } = useTranslation()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("project.settings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("project.settings.slug")}</label>
            <p className="text-sm font-mono mt-1">{projectSlug}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("project.settings.team")}</label>
            <p className="text-sm mt-1">{teamSlug}</p>
          </div>
          {description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("project.settings.description")}</label>
              <p className="text-sm mt-1">{description}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-muted-foreground">{t("project.settings.url")}</label>
            <p className="text-sm font-mono mt-1">{(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/^https?:\/\//, "")}/{teamSlug}/{projectSlug}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
