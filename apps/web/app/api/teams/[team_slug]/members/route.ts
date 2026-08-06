import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * 获取团队成员列表
 * @summary 获取成员列表
 * @description 返回指定团队的所有成员，包含用户信息和角色。
 * @response 200:{ members: Array<{ userId, userSlug, displayName, avatarUrl, role, joinedAt }> }:成员列表
 * @response 404:ErrorResponse:团队未找到
 * @tag Members
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const members = await db
    .select({
      userId: teamMembers.userId,
      userSlug: users.userSlug,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(teamMembers.joinedAt);

  return NextResponse.json({ members });
}

/**
 * 邀请成员加入团队
 * @summary 邀请成员
 * @description 邀请指定用户加入团队，仅 owner 可操作。新成员默认为 member 角色。
 * @body { user_slug: string }
 * @response 200:{ success: true }:邀请成功
 * @response 400:ErrorResponse:缺少 user_slug
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非 owner 无权限
 * @response 404:ErrorResponse:团队或用户未找到
 * @response 409:ErrorResponse:已是团队成员
 * @tag Members
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

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // 验证当前用户是 owner
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const body = await request.json();
  const { user_slug } = body;
  if (!user_slug) {
    return NextResponse.json({ error: 'user_slug is required' }, { status: 400 });
  }

  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.userSlug, user_slug), eq(users.type, 'user')),
    columns: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const existing = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUser.id)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Already a member' }, { status: 409 });
  }

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: targetUser.id,
    role: 'member',
  });

  return NextResponse.json({ success: true });
}
