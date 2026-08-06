import { Suspense } from "react"
import { getSession } from "@/lib/auth/cookies"
import { db, users, projects } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { ProjectPage } from "./project-page"
import { ReadPageServer, generateReadPageMetadata } from "@/components/pages/read-page-server"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ user_slug: string; page_id: string }>
  searchParams: Promise<{ tab?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_slug, page_id } = await params

  // Check if this is a team → project route
  const profileUser = await db.query.users.findFirst({
    where: eq(users.userSlug, user_slug),
    columns: { type: true },
  })
  if (profileUser?.type === "team") {
    const team = await db.query.users.findFirst({
      where: and(eq(users.userSlug, user_slug), eq(users.type, "team")),
      columns: { id: true },
    })
    if (!team) return { title: "未找到" }
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, page_id)),
      columns: { name: true },
    })
    if (!project) return { title: "项目未找到" }
    return { title: `${project.name} - ${user_slug}` }
  }

  return generateReadPageMetadata(user_slug, page_id)
}

export default async function PagePage({ params, searchParams }: PageProps) {
  const { user_slug, page_id } = await params
  const { tab } = await searchParams
  const activeTab = tab ?? "read"
  const session = await getSession()

  // Team → Project route
  const profileUser = await db.query.users.findFirst({
    where: eq(users.userSlug, user_slug),
    columns: { type: true },
  })
  if (profileUser?.type === "team") {
    return (
      <>
        <script
          id="viben-project-meta"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ teamSlug: user_slug, projectSlug: page_id }),
          }}
        />
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
          <ProjectPage teamSlug={user_slug} projectSlug={page_id} session={session} tab={activeTab === "read" ? undefined : activeTab} />
        </Suspense>
      </>
    )
  }

  // T1: Blocking — page context + permission check (delegated to ReadPageServer)
  return <ReadPageServer userSlug={user_slug} pageId={page_id} session={session} activeTab={activeTab} />
}

// Note: injector components moved to @/components/pages/read-page-server
