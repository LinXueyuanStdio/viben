import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function getTeamBySlug(teamSlug: string, userId?: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: {
      id: true, userSlug: true, displayName: true, avatarUrl: true,
      bio: true, websiteUrl: true, createdAt: true,
    },
  });
  if (!team) return null;

  let currentUserRole: string | null = null;
  if (userId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
      columns: { role: true },
    });
    currentUserRole = membership?.role ?? null;
  }

  return { ...team, currentUserRole };
}

async function requireOwner(teamSlug: string, userId: string): Promise<boolean> {
  const membership = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(and(eq(users.userSlug, teamSlug), eq(teamMembers.userId, userId)))
    .limit(1);

  return membership.length > 0 && membership[0].role === 'owner';
}

/**
 * 获取团队详情
 * @summary 获取团队详情
 * @description 返回指定团队的详细信息，包括 displayName、avatarUrl、bio、websiteUrl、createdAt 及当前用户在团队中的角色。
 * @response 200:{ team: TeamDetail }:团队详情
 * @response 404:ErrorResponse:团队未找到
 * @tag Teams
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  const team = await getTeamBySlug(team_slug, session?.userId);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }
  return NextResponse.json({ team });
}

/**
 * 更新团队设置
 * @summary 更新团队设置
 * @description 更新团队的显示名称、简介、头像或网站链接。仅 owner 可操作。
 * @body { display_name?: string, bio?: string, avatar_url?: string, website_url?: string }
 * @response 200:{ success: true }:更新成功
 * @response 400:ErrorResponse:无有效更新字段
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非 owner 无权限
 * @response 404:ErrorResponse:团队未找到
 * @tag Teams
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOwner = await requireOwner(team_slug, session.userId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.display_name !== undefined) updateData.displayName = body.display_name;
  if (body.bio !== undefined) updateData.bio = body.bio;
  if (body.avatar_url !== undefined) updateData.avatarUrl = body.avatar_url;
  if (body.website_url !== undefined) updateData.websiteUrl = body.website_url;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  await db.update(users)
    .set(updateData)
    .where(eq(users.id, team.id));

  return NextResponse.json({ success: true });
}

/**
 * 删除团队
 * @summary 删除团队
 * @description 删除指定团队，会级联删除团队成员关系和 projects。仅 owner 可操作。
 * @response 200:{ success: true }:删除成功
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非 owner 无权限
 * @response 404:ErrorResponse:团队未找到
 * @tag Teams
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOwner = await requireOwner(team_slug, session.userId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // ON DELETE CASCADE 自动清理 team_members 和 projects
  await db.delete(users).where(eq(users.id, team.id));

  return NextResponse.json({ success: true });
}
