import { Suspense } from "react"
import { db, users, teamMembers, projects, userFollows } from "@/lib/db"
import { eq, and, count } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { Session } from "@/lib/auth/types"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { TeamOverview } from "@/components/team/team-overview"
import { ProjectListSkeleton } from "@/components/team/team-skeletons"
import { FollowButton } from "@/components/content/follow-button"

interface ProjectsLoaderProps {
  teamId: string
  teamSlug: string
  currentUserRole: string | null
}

async function ProjectsLoader({ teamId, teamSlug, currentUserRole }: ProjectsLoaderProps) {
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

interface TeamPageProps {
  teamSlug: string
  session: Session | null
}

export async function TeamPage({ teamSlug, session }: TeamPageProps) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, "team")),
    columns: {
      id: true, userSlug: true, displayName: true, avatarUrl: true,
      bio: true, websiteUrl: true, followersCount: true, createdAt: true,
    },
  })
  if (!team) notFound()

  let currentUserRole: string | null = null
  let isFollowing = false
  if (session?.userId) {
    const [membership, followRecord] = await Promise.all([
      db.query.teamMembers.findFirst({
        where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
        columns: { role: true },
      }),
      db.query.userFollows.findFirst({
        where: and(
          eq(userFollows.followerUserId, session.userId),
          eq(userFollows.followeeUserId, team.id),
        ),
      }),
    ])
    currentUserRole = membership?.role ?? null
    isFollowing = !!followRecord
  }

  // 团队统计：成员数、项目数、正在关注数
  const [memberCountRow, projectCountRow, followingCountRow] = await Promise.all([
    db.select({ count: count() }).from(teamMembers).where(eq(teamMembers.teamId, team.id)),
    db.select({ count: count() }).from(projects).where(eq(projects.teamId, team.id)),
    db.select({ count: count() }).from(userFollows).where(eq(userFollows.followerUserId, team.id)),
  ])

  const stats = {
    followersCount: team.followersCount ?? 0,
    followingCount: followingCountRow[0]?.count ?? 0,
    memberCount: memberCountRow[0]?.count ?? 0,
    projectCount: projectCountRow[0]?.count ?? 0,
  }

  return (
    <TeamPageShell
      teamSlug={team.userSlug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      teamBio={team.bio}
      teamWebsiteUrl={team.websiteUrl}
      stats={stats}
      currentUserRole={currentUserRole}
      followButton={
        session ? (
          <FollowButton
            userSlug={team.userSlug}
            currentUserSlug={session.userSlug}
            initialFollowing={isFollowing}
            className="shrink-0"
          />
        ) : null
      }
      showProfileHeader
    >
      <Suspense fallback={<ProjectListSkeleton />}>
        <ProjectsLoader
          teamId={team.id}
          teamSlug={team.userSlug}
          currentUserRole={currentUserRole}
        />
      </Suspense>
    </TeamPageShell>
  )
}
