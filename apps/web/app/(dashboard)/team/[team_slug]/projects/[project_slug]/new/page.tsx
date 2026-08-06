import { getSession } from "@/lib/auth/cookies"
import { notFound, redirect } from "next/navigation"
import { db, users, projects, teamMembers } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { ProjectPageEditor } from "@/components/project/project-page-editor"
import { ProjectPageShell } from "@/components/project/project-page-shell"

export const dynamic = "force-dynamic"

export default async function NewProjectPagePage({
  params,
}: {
  params: Promise<{ team_slug: string; project_slug: string }>
}) {
  const { team_slug, project_slug } = await params
  const session = await getSession()
  if (!session?.userId) redirect(`/login?redirect=/team/${team_slug}/projects/${project_slug}/new`)

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, "team")),
    columns: { id: true, displayName: true },
  })
  if (!team) notFound()

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, project_slug)),
    columns: { id: true, name: true, projectSlug: true },
  })
  if (!project) notFound()

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  })
  if (!membership) redirect(`/${team_slug}/${project_slug}`)

  return (
    <ProjectPageShell
      teamSlug={team_slug}
      projectSlug={project_slug}
      projectName={project.name}
    >
      <ProjectPageEditor
        userSlug={session.userSlug}
        teamSlug={team_slug}
        projectSlug={project_slug}
      />
    </ProjectPageShell>
  )
}
