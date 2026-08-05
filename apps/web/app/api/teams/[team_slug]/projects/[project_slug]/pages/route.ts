import { NextResponse } from 'next/server';
import { db, users, projects, projectPages, publishedPages, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function resolveProject(teamSlug: string, projectSlug: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return null;

  return db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, projectSlug)),
    columns: { id: true, name: true, projectSlug: true },
  });
}

/**
 * GET /api/teams/{team_slug}/projects/{project_slug}/pages — Project 下的 pages 列表
 * @tag Projects
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const project = await resolveProject(team_slug, project_slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const pages = await db
    .select({
      pageId: publishedPages.id,
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      coverUrl: publishedPages.coverUrl,
      authorSlug: publishedPages.authorSlug,
      lastPublishedAt: publishedPages.lastPublishedAt,
      addedAt: projectPages.addedAt,
    })
    .from(projectPages)
    .innerJoin(publishedPages, eq(projectPages.pageId, publishedPages.id))
    .where(eq(projectPages.projectId, project.id))
    .orderBy(projectPages.addedAt);

  return NextResponse.json({ pages });
}

/**
 * POST /api/teams/{team_slug}/projects/{project_slug}/pages — 添加 page 到 Project
 * Body: { page_id: string }
 * @tag Projects
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await resolveProject(team_slug, project_slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // 需要是 team member
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (team) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
      columns: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
    }
  }

  const { page_id } = await request.json();
  if (!page_id) {
    return NextResponse.json({ error: 'page_id is required' }, { status: 400 });
  }

  const existing = await db.query.projectPages.findFirst({
    where: and(eq(projectPages.projectId, project.id), eq(projectPages.pageId, page_id)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Page already in project' }, { status: 409 });
  }

  await db.insert(projectPages).values({
    projectId: project.id,
    pageId: page_id,
    addedBy: session.userId,
  });

  return NextResponse.json({ success: true });
}
