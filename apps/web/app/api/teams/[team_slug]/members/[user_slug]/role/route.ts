import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * PUT /api/teams/{team_slug}/members/{user_slug}/role — 修改成员角色（需 owner）
 * Body: { role: 'owner' | 'member' }
 * @tag Teams
 */
export async function PUT(
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

  const { role } = await request.json();
  if (role !== 'owner' && role !== 'member') {
    return NextResponse.json({ error: 'role must be owner or member' }, { status: 400 });
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.userSlug, user_slug),
    columns: { id: true },
  });
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUser.id)));

  return NextResponse.json({ success: true });
}
