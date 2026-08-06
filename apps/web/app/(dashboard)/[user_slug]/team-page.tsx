import { db, users, teamMembers, projects } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { Session } from "@/lib/auth/types"
import { TeamPageShell } from "@/components/team/team-page-shell"

interface TeamPageProps {
  teamSlug: string
  session: Session | null
}

export async function TeamPage({ teamSlug, session }: TeamPageProps) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, "team")),
    columns: {
      id: true, userSlug: true, displayName: true, avatarUrl: true,
      bio: true, createdAt: true,
    },
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

  const projectList = await db
    .select({
      projectSlug: projects.projectSlug,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.teamId, team.id))
    .orderBy(projects.updatedAt)

  return (
    <TeamPageShell
      teamSlug={team.userSlug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      currentUserRole={currentUserRole}
      projects={projectList}
    />
  )
}
