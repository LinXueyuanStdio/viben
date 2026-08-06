import { Suspense } from "react"
import { db, users, projects, projectPages, publishedPages, teamMembers } from "@/lib/db"
import { eq, and, count } from "drizzle-orm"
import { notFound } from "next/navigation"
import type { Session } from "@/lib/auth/types"
import { ProjectPageShell } from "@/components/project/project-page-shell"
import { ProjectOverview } from "@/components/project/project-overview"
import { ProjectPagesList } from "@/components/project/project-pages-list"
import { ProjectSettingsLoader } from "@/components/project/project-settings"
import { ProjectListSkeleton } from "@/components/team/team-skeletons"
import { ProjectDrawerClient } from "@/components/project/project-drawer-client"
import type { ProjectMetaData } from "@/components/project/project-meta"

interface Props {
  teamSlug: string
  projectSlug: string
  session: Session | null
  tab?: string
}

async function PagesLoader({ projectId, teamSlug, projectSlug, defaultPageId, isPageManager }: {
  projectId: string; teamSlug: string; projectSlug: string
  defaultPageId: string | null; isPageManager: boolean
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

  return <ProjectPagesList teamSlug={teamSlug} projectSlug={projectSlug} pages={pages} defaultPageId={defaultPageId} isPageManager={isPageManager} />
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
      createdAt: true,
    },
  })
  if (!project) notFound()

  // 权限：team owner 或 project 创建者可以管理页面（如设置封面）
  let isPageManager = project.createdBy === session?.userId
  if (!isPageManager && session?.userId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
      columns: { role: true },
    })
    isPageManager = membership?.role === "owner"
  }

  // ProjectDrawer: pages count
  const pagesCountResult = await db
    .select({ count: count() })
    .from(projectPages)
    .where(eq(projectPages.projectId, project.id))
  const pagesCount = pagesCountResult[0]?.count ?? 0

  // ProjectDrawer: creator info
  const creator = await db.query.users.findFirst({
    where: eq(users.id, project.createdBy),
    columns: { userSlug: true, displayName: true, avatarUrl: true },
  })

  const isAuthenticated = !!session
  const communityEntityId = `project:${project.id}`

  const projectMeta: ProjectMetaData = {
    name: project.name,
    projectSlug: project.projectSlug,
    description: project.description,
    team: {
      slug: teamSlug,
      displayName: team.displayName ?? teamSlug,
    },
    createdBy: {
      userSlug: creator?.userSlug ?? "",
      displayName: creator?.displayName ?? "Unknown",
      avatarUrl: creator?.avatarUrl ?? null,
    },
    createdAt: project.createdAt ?? new Date(),
    stats: { pagesCount },
  }

  // 优先使用 project.defaultPageId，未设置或页面已移除时回退到第一个 page
  let defaultPage = null
  if (project.defaultPageId) {
    defaultPage = await db.query.projectPages.findFirst({
      where: and(
        eq(projectPages.projectId, project.id),
        eq(projectPages.pageId, project.defaultPageId),
      ),
      with: {
        page: { columns: { id: true, html: true, title: true } },
      },
    })
  }
  if (!defaultPage) {
    defaultPage = await db.query.projectPages.findFirst({
      where: eq(projectPages.projectId, project.id),
      orderBy: (projectPages, { asc }) => [asc(projectPages.addedAt)],
      with: {
        page: { columns: { id: true, html: true, title: true } },
      },
    })
  }

  const content = (() => {
    switch (tab) {
      case "pages":
        return (
          <div
            className="overflow-y-auto"
            style={{ height: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))" }}
          >
            <div className="w-[min(1280px,100%)] mx-auto px-4 py-4">
              <Suspense fallback={<ProjectListSkeleton />}>
                <PagesLoader projectId={project.id} teamSlug={teamSlug} projectSlug={projectSlug} defaultPageId={project.defaultPageId ?? null} isPageManager={isPageManager} />
              </Suspense>
            </div>
          </div>
        )
      case "settings":
        return (
          <div
            className="overflow-y-auto"
            style={{ height: "calc(100vh - var(--reader-header-safe, var(--nav-h, 56px)))" }}
          >
            <div className="w-[min(1280px,100%)] mx-auto px-4 py-4">
              <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
                <ProjectSettingsLoader
                  projectSlug={projectSlug}
                  teamSlug={teamSlug}
                  description={project.description}
                  createdBy={project.createdBy}
                />
              </Suspense>
            </div>
          </div>
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
    <>
      <ProjectPageShell teamSlug={teamSlug} projectSlug={projectSlug}>
        {content}
      </ProjectPageShell>
      <ProjectDrawerClient
        projectMeta={projectMeta}
        projectDbId={project.id}
        communityEntityId={communityEntityId}
        isAuthenticated={isAuthenticated}
        sessionUsername={session?.username}
        sessionAvatarUrl={session?.avatarUrl ?? undefined}
        sessionUserId={session?.userId}
        tabs={["details", "comments", "notes"]}
      />
    </>
  )
}
