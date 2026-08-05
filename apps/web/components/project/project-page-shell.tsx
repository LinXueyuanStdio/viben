"use client"

import { ProjectTablist } from "./project-tablist"
import { ProjectOverview } from "./project-overview"

interface PageItem {
  pageId: string
  uid: string
  title: string
  description: string | null
  coverUrl: string | null
  authorSlug: string
  html: string
  addedAt: string | Date
}

interface ProjectItem {
  name: string
  projectSlug: string
  description: string | null
  defaultPageId: string | null
  createdBy: string
}

interface ProjectPageShellProps {
  teamSlug: string
  project: ProjectItem
  pages: PageItem[]
  defaultPage: PageItem | null
}

export function ProjectPageShell({ teamSlug, project, pages, defaultPage }: ProjectPageShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">{project.name}</h1>
      </div>

      <ProjectTablist teamSlug={teamSlug} projectSlug={project.projectSlug} activeTab="overview" />

      <div className="min-w-0">
        <ProjectOverview
          defaultPage={defaultPage}
          teamSlug={teamSlug}
          projectSlug={project.projectSlug}
        />
      </div>
    </div>
  )
}
