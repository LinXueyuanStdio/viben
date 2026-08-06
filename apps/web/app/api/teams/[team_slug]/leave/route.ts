import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, sql } from 'drizzle-orm';

/**
 * 离开团队
 * @summary 离开团队
 * @description 当前用户退出指定团队。如果用户是唯一的 owner，则不能离开（需先转让所有权）。
 * @response 200:{ success: true }:离开成功
 * @response 400:ErrorResponse:唯一 owner 不能离开
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:团队未找到或非团队成员
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

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 404 });

  if (membership.role === 'owner') {
    const ownerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.role, 'owner')));
    const count = Number(ownerCount[0]?.count ?? 0);
    if (count <= 1) {
      return NextResponse.json(
        { error: 'Cannot leave: you are the only owner. Transfer ownership first.' },
        { status: 400 }
      );
    }
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)));

  return NextResponse.json({ success: true });
}
