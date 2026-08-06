import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { TeamMembersList } from "@/components/team/team-members-list"
import { db, users, teamMembers } from "@/lib/db"
import { eq, and, count } from "drizzle-orm"

const PAGE_SIZE = 20

export default async function TeamMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ team_slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { team_slug } = await params
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)
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

  const [countResult, members] = await Promise.all([
    db
      .select({ count: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id)),
    db
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
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ])

  const total = countResult[0]?.count ?? 0

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
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </TeamPageShell>
  )
}
