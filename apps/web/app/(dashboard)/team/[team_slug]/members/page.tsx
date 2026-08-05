import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { TeamMembersList } from "@/components/team/team-members-list"
import { db, users, teamMembers } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export default async function TeamMembersPage({
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

  const members = await db
    .select({
      userId: teamMembers.userId,
      userSlug: users.userSlug,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(teamMembers.joinedAt)

  return (
    <TeamPageShell
      teamSlug={team_slug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      currentUserRole={currentUserRole}
      activeTab="members"
    >
      <TeamMembersList
        teamSlug={team_slug}
        members={members}
        currentUserRole={currentUserRole}
      />
    </TeamPageShell>
  )
}
