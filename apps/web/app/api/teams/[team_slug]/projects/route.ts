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
 * 获取团队下的项目列表
 * @summary 获取项目列表
 * @description 返回指定团队下的所有 projects，包含项目基本信息和时间戳。
 * @response 200:{ projects: Array<{ id, name, projectSlug, description, defaultPageId, createdBy, createdAt, updatedAt }> }:项目列表
 * @response 404:ErrorResponse:团队未找到
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
 * 在团队下创建项目
 * @summary 创建项目
 * @description 在指定团队下创建新项目，需要是团队成员。project_slug 在团队内必须唯一。
 * @body { name: string, project_slug: string, description?: string }
 * @response 200:{ success: true, project_slug: string, project_id: string }:创建成功
 * @response 400:ErrorResponse:缺少 name 或 project_slug
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非团队成员
 * @response 404:ErrorResponse:团队未找到
 * @response 409:ErrorResponse:project_slug 在该团队内已存在
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
  const { name, project_slug, description, visibility } = body;
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
    visibility: visibility === 'private' ? 'private' : 'public',
    createdBy: session.userId,
  });

  return NextResponse.json({ success: true, project_slug, project_id: projectId });
}
