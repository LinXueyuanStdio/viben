import { NextResponse } from 'next/server';
import { db, users, teamMembers, projects } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function resolveTeam(teamSlug: string) {
  return db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true, displayName: true, userSlug: true },
  });
}

/**
 * GET /api/teams/{team_slug}/projects — 团队下 projects 列表
 * @tag Projects
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const team = await resolveTeam(team_slug);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
      projectSlug: projects.projectSlug,
      description: projects.description,
      defaultPageId: projects.defaultPageId,
      createdBy: projects.createdBy,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.teamId, team.id))
    .orderBy(projects.updatedAt);

  return NextResponse.json({ projects: projectList });
}

/**
 * POST /api/teams/{team_slug}/projects — 创建 Project
 * Body: { name: string, project_slug: string, description?: string }
 * @tag Projects
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await resolveTeam(team_slug);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // 检查是否团队成员
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
  }

  const body = await request.json();
  const { name, project_slug, description } = body;
  if (!name || !project_slug) {
    return NextResponse.json({ error: 'name and project_slug are required' }, { status: 400 });
  }

  // 校验 project_slug 在该 team 内唯一
  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, project_slug)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Project slug already exists in this team' },
      { status: 409 }
    );
  }

  const projectId = crypto.randomUUID();
  await db.insert(projects).values({
    id: projectId,
    teamId: team.id,
    name,
    projectSlug: project_slug,
    description: description ?? null,
    createdBy: session.userId,
  });

  return NextResponse.json({ success: true, project_slug, project_id: projectId });
}
