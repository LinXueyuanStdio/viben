import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';

/**
 * GET /api/teams — 获取当前用户所属的团队列表
 * @tag Teams
 */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      teamSlug: users.userSlug,
      teamName: users.displayName,
      teamAvatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(eq(teamMembers.userId, session.userId))
    .orderBy(teamMembers.joinedAt);

  return NextResponse.json({ teams: memberships });
}

/**
 * POST /api/teams — 创建团队
 * Body: { name: string, slug: string }
 * @tag Teams
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // 校验 slug 唯一性
  const existing = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `The name '${slug}' is already taken.` },
      { status: 409 }
    );
  }

  const teamId = crypto.randomUUID();

  // 创建 team user 记录
  await db.insert(users).values({
    id: teamId,
    email: session.email,
    username: slug,
    userSlug: slug,
    displayName: name,
    type: 'team',
    role: 'user',
    emailVerified: true,
  });

  // 加创建者为 owner
  await db.insert(teamMembers).values({
    teamId,
    userId: session.userId,
    role: 'owner',
  });

  return NextResponse.json({
    success: true,
    team_slug: slug,
    team_id: teamId,
  });
}
