import { Suspense } from "react"
import { db, users, projects, projectPages, publishedPages } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { Session } from "@/lib/auth/types"
import { ProjectPageShell } from "@/components/project/project-page-shell"
import { ProjectOverview } from "@/components/project/project-overview"
import { ProjectPagesList } from "@/components/project/project-pages-list"
import { ProjectSettingsLoader } from "@/components/project/project-settings"
import { ProjectListSkeleton } from "@/components/team/team-skeletons"

interface Props {
  teamSlug: string
  projectSlug: string
  session: Session | null
  tab?: string
}

async function PagesLoader({ projectId, teamSlug, projectSlug }: {
  projectId: string; teamSlug: string; projectSlug: string
}) {
  const pages = await db
    .select({
      pageId: publishedPages.id,
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      coverUrl: publishedPages.coverUrl,
      authorSlug: publishedPages.authorSlug,
      addedAt: projectPages.addedAt,
    })
    .from(projectPages)
    .innerJoin(publishedPages, eq(projectPages.pageId, publishedPages.id))
    .where(eq(projectPages.projectId, projectId))
    .orderBy(projectPages.addedAt)

  return <ProjectPagesList teamSlug={teamSlug} projectSlug={projectSlug} pages={pages} />
}

export async function ProjectPage({ teamSlug, projectSlug, session, tab }: Props) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, "team")),
    columns: { id: true, displayName: true, avatarUrl: true },
  })
  if (!team) notFound()

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, projectSlug)),
    columns: {
      id: true, name: true, projectSlug: true,
      description: true, defaultPageId: true, createdBy: true,
    },
  })
  if (!project) notFound()

  const defaultPage = await db.query.projectPages.findFirst({
    where: eq(projectPages.projectId, project.id),
    orderBy: (projectPages, { asc }) => [asc(projectPages.addedAt)],
    with: {
      page: { columns: { id: true, html: true, title: true } },
    },
  })

  const content = (() => {
    switch (tab) {
      case "pages":
        return (
          <Suspense fallback={<ProjectListSkeleton />}>
            <PagesLoader projectId={project.id} teamSlug={teamSlug} projectSlug={projectSlug} />
          </Suspense>
        )
      case "settings":
        return (
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
            <ProjectSettingsLoader
              projectSlug={projectSlug}
              teamSlug={teamSlug}
              description={project.description}
              createdBy={project.createdBy}
            />
          </Suspense>
        )
      default:
        return (
          <ProjectOverview
            defaultPage={defaultPage?.page ?? null}
            teamSlug={teamSlug}
            projectSlug={projectSlug}
          />
        )
    }
  })()

  return (
    <ProjectPageShell
      teamSlug={teamSlug}
      projectSlug={projectSlug}
      projectName={project.name}
    >
      {content}
    </ProjectPageShell>
  )
}
