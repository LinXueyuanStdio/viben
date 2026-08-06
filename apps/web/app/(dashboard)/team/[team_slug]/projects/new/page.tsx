import { getSession } from "@/lib/auth/cookies"
import { notFound, redirect } from "next/navigation"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { NewProjectForm } from "./new-project-form"
import { db, users, teamMembers } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ team_slug: string }>
}) {
  const { team_slug } = await params
  const session = await getSession()
  if (!session?.userId) redirect(`/login?redirect=/team/${team_slug}/projects/new`)

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, "team")),
    columns: { id: true, displayName: true, avatarUrl: true, userSlug: true },
  })
  if (!team) notFound()

  let currentUserRole: string | null = null
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  })
  currentUserRole = membership?.role ?? null
  if (!currentUserRole) redirect(`/team/${team_slug}`)

  return (
    <TeamPageShell
      teamSlug={team_slug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      currentUserRole={currentUserRole}
      activeTab="projects"
    >
      <NewProjectForm teamSlug={team_slug} />
    </TeamPageShell>
  )
}
