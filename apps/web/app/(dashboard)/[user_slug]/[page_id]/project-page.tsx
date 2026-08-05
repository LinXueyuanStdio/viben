import { db, users, projects, projectPages, publishedPages } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { Session } from "@/lib/auth/types"
import { ProjectPageShell } from "@/components/project/project-page-shell"

interface Props {
  teamSlug: string
  projectSlug: string
  session: Session | null
}

export async function ProjectPage({ teamSlug, projectSlug, session }: Props) {
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

  const pages = await db
    .select({
      pageId: publishedPages.id,
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      coverUrl: publishedPages.coverUrl,
      authorSlug: publishedPages.authorSlug,
      html: publishedPages.html,
      addedAt: projectPages.addedAt,
    })
    .from(projectPages)
    .innerJoin(publishedPages, eq(projectPages.pageId, publishedPages.id))
    .where(eq(projectPages.projectId, project.id))
    .orderBy(projectPages.addedAt)

  const defaultPage = (project.defaultPageId
    ? pages.find((p) => p.pageId === project.defaultPageId)
    : pages[0]) ?? null

  return (
    <ProjectPageShell
      teamSlug={teamSlug}
      project={project}
      pages={pages}
      defaultPage={defaultPage}
    />
  )
}
