import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, sql } from 'drizzle-orm';

/**
 * POST /api/teams/{team_slug}/leave — 离开团队
 * @tag Teams
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
