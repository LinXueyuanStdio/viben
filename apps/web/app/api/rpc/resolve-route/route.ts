import { NextResponse } from 'next/server'
import { cache } from 'react'
import { db, users, projects, projectPages, publishedPages } from '@/lib/db'
import { eq, and } from 'drizzle-orm'

// ---- React.cache() 包装的查询（同一次请求内与 page.tsx 共享） ----

const getSlugType = cache(async (slug: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { type: true, id: true, displayName: true },
  })
  return user ?? null
})

const getProject = cache(async (teamId: string, projectSlug: string) => {
  return db.query.projects.findFirst({
    where: and(eq(projects.teamId, teamId), eq(projects.projectSlug, projectSlug)),
    columns: { id: true, name: true, projectSlug: true },
  })
})

const getProjectPage = cache(async (projectId: string, pageSlug: string) => {
  return db
    .select({
      uid: publishedPages.uid,
      title: publishedPages.title,
    })
    .from(projectPages)
    .innerJoin(publishedPages, eq(projectPages.pageId, publishedPages.id))
    .where(and(eq(projectPages.projectId, projectId), eq(publishedPages.uid, pageSlug)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
})

// ---- 已知路由第一段（Level 1 快速匹配） ----

const KNOWN_FIRST_SEGMENTS = new Set([
  'moment', 'leaderboard', 'category', 'search', 'tags',
  'settings', 'admin', 'assistant', 'pages', 'collections',
  'market', 'mcp-market', 'skill-market', 'publish',
  'notifications', 'history', 'code-stats', 'home', 'web',
  'docs', 'read', 'login', 'register',
])

// ---- 路由解析 ----

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slugsParam = searchParams.get('slugs')
  if (!slugsParam) {
    return NextResponse.json({ error: 'Missing slugs parameter' }, { status: 400 })
  }

  const parts = slugsParam.split(',').map(decodeURIComponent).filter(Boolean)
  if (parts.length === 0 || parts.length > 3) {
    return NextResponse.json({ error: 'Invalid slugs length (1-3)' }, { status: 400 })
  }

  const [first, second, third] = parts

  // 已知路由快速返回
  if (KNOWN_FIRST_SEGMENTS.has(first)) {
    return NextResponse.json({ type: 'dashboard' })
  }

  // 查询第一段类型
  const firstResult = await getSlugType(first)
  if (!firstResult) {
    return NextResponse.json({ type: 'not-found' })
  }

  // ---- user 路由 ----
  if (firstResult.type === 'user') {
    if (parts.length === 1) {
      return NextResponse.json({
        type: 'user-overview',
        userSlug: first,
        userDisplayName: firstResult.displayName,
      })
    }
    if (parts.length === 2) {
      return NextResponse.json({
        type: 'read-page',
        userSlug: first,
        userDisplayName: firstResult.displayName,
        pageSlug: second,
      })
    }
    return NextResponse.json({ type: 'not-found' })
  }

  // ---- team 路由 ----
  if (firstResult.type === 'team') {
    if (parts.length === 1) {
      return NextResponse.json({
        type: 'team-overview',
        teamSlug: first,
        teamDisplayName: firstResult.displayName,
      })
    }

    // 2 段：检查是否为 project
    const project = await getProject(firstResult.id, second)
    if (project) {
      if (parts.length === 2) {
        return NextResponse.json({
          type: 'project-overview',
          teamSlug: first,
          teamDisplayName: firstResult.displayName,
          projectSlug: project.projectSlug,
          projectDisplayName: project.name,
        })
      }
      // 3 段：检查是否为 project 内的 page
      if (parts.length === 3) {
        const page = await getProjectPage(project.id, third)
        if (page) {
          return NextResponse.json({
            type: 'project-page',
            teamSlug: first,
            teamDisplayName: firstResult.displayName,
            projectSlug: project.projectSlug,
            projectDisplayName: project.name,
            pageSlug: page.uid,
          })
        }
      }
    }

    // team sub-route: /team/{slug}/projects, members, settings 等
    // 这些由 pathname pattern 在客户端判断，此处返回 team-overview
    return NextResponse.json({
      type: 'team-overview',
      teamSlug: first,
      teamDisplayName: firstResult.displayName,
    })
  }

  return NextResponse.json({ type: 'not-found' })
}
