import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * 移除团队成员
 * @summary 移除成员
 * @description 将指定用户移出团队。仅 owner 可操作，不能移除自己（请使用 leave 接口）。
 * @response 200:{ success: true }:移除成功
 * @response 400:ErrorResponse:不能移除自己
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:非 owner 无权限
 * @response 404:ErrorResponse:团队或用户未找到
 * @tag Members
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; user_slug: string }> }
) {
  const { team_slug, user_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const ownerCheck = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!ownerCheck || ownerCheck.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.userSlug, user_slug),
    columns: { id: true },
  });
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (targetUser.id === session.userId) {
    return NextResponse.json(
      { error: 'Cannot remove yourself. Use leave endpoint.' },
      { status: 400 }
    );
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUser.id)));

  return NextResponse.json({ success: true });
}
