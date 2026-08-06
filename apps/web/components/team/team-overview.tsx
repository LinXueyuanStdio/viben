"use client"

import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ProjectItem {
  projectSlug: string
  name: string
  description: string | null
  createdAt: string | Date
}

interface TeamOverviewProps {
  teamSlug: string
  projects: ProjectItem[]
  currentUserRole: string | null
}

export function TeamOverview({ teamSlug, projects, currentUserRole }: TeamOverviewProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const canCreate = currentUserRole === "owner" || currentUserRole === "member"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("team.overview.projects")}</h2>
        {canCreate && (
          <Button size="sm" onClick={() => router.push(`/team/${teamSlug}/projects/new`)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("team.overview.newProject")}
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
          <h3 className="text-lg font-medium">{t("team.overview.empty")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("team.overview.emptyHint")}
          </p>
          {canCreate && (
            <Button onClick={() => router.push(`/team/${teamSlug}/projects/new`)}>
              {t("team.overview.createProject")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.projectSlug}
              href={`/${teamSlug}/${project.projectSlug}`}
              className="block rounded-lg border p-4 hover:border-primary/50 transition-colors"
            >
              <h3 className="font-semibold">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
