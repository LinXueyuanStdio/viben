import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { TeamSettingsForm } from "@/components/team/team-settings-form"
import { TeamApiKeys } from "@/components/team/team-api-keys"
import { db, users, teamMembers } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ team_slug: string }>
}) {
  const { team_slug } = await params
  const session = await getSession()

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, "team")),
    columns: {
      id: true, displayName: true, avatarUrl: true, userSlug: true,
      bio: true, websiteUrl: true,
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

  const isOwner = currentUserRole === "owner"

  return (
    <TeamPageShell
      teamSlug={team_slug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      currentUserRole={currentUserRole}
      activeTab="settings"
      showHeader={false}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <TeamSettingsForm
          teamSlug={team.userSlug}
          displayName={team.displayName}
          bio={team.bio}
          websiteUrl={team.websiteUrl}
          avatarUrl={team.avatarUrl}
          isOwner={isOwner}
        />
        {isOwner && <TeamApiKeys teamSlug={team_slug} />}
      </div>
    </TeamPageShell>
  )
}
