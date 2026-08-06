import { Suspense } from "react"
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { TeamOverview } from "@/components/team/team-overview"
import { ProjectListSkeleton } from "@/components/team/team-skeletons"
import { db, users, teamMembers, projects } from "@/lib/db"
import { eq, and } from "drizzle-orm"

interface ProjectsListLoaderProps {
  teamId: string
  teamSlug: string
  currentUserRole: string | null
}

async function ProjectsListLoader({ teamId, teamSlug, currentUserRole }: ProjectsListLoaderProps) {
  const projectList = await db
    .select({
      projectSlug: projects.projectSlug,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.teamId, teamId))
    .orderBy(projects.updatedAt)

  return (
    <TeamOverview
      teamSlug={teamSlug}
      projects={projectList}
      currentUserRole={currentUserRole}
    />
  )
}

export default async function TeamProjectsPage({
  params,
}: {
  params: Promise<{ team_slug: string }>
}) {
  const { team_slug } = await params
  const session = await getSession()

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, "team")),
    columns: { id: true, displayName: true, avatarUrl: true, userSlug: true },
  })
  if (!team) notFound()

  let currentUserRole: string | null = null
  if (session?.userId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
      columns: { role: true },
    })
    currentUserRole = membership?.role ?? null
  }

  return (
    <TeamPageShell
      teamSlug={team_slug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      currentUserRole={currentUserRole}
      activeTab="projects"
    >
      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectsListLoader
          teamId={team.id}
          teamSlug={team_slug}
          currentUserRole={currentUserRole}
        />
      </Suspense>
    </TeamPageShell>
  )
}
