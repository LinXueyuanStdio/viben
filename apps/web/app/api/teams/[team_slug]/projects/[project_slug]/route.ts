import { NextResponse } from 'next/server';
import { db, users, teamMembers, projects } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function resolveProject(teamSlug: string, projectSlug: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return { team: null, project: null };

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, projectSlug)),
    columns: {
      id: true, name: true, projectSlug: true, description: true,
      defaultPageId: true, createdBy: true, createdAt: true, updatedAt: true, teamId: true,
    },
  });
  return { team, project };
}

/**
 * GET /api/teams/{team_slug}/projects/{project_slug} — Project 详情
 * @tag Projects
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const { project } = await resolveProject(team_slug, project_slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ project });
}

/**
 * PATCH /api/teams/{team_slug}/projects/{project_slug} — 更新 Project
 * Body: { name?: string, description?: string, default_page_id?: string }
 * @tag Projects
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { team, project } = await resolveProject(team_slug, project_slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // 权限：team owner 或 project 创建者
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team!.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  const isOwner = membership?.role === 'owner';
  const isCreator = project.createdBy === session.userId;
  if (!isOwner && !isCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.default_page_id !== undefined) updateData.defaultPageId = body.default_page_id;

  await db.update(projects).set(updateData).where(eq(projects.id, project.id));

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/teams/{team_slug}/projects/{project_slug} — 删除 Project
 * @tag Projects
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { team, project } = await resolveProject(team_slug, project_slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team!.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  const isOwner = membership?.role === 'owner';
  const isCreator = project.createdBy === session.userId;
  if (!isOwner && !isCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  return NextResponse.json({ success: true });
}
