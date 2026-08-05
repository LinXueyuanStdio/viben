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
 * GET /api/teams/{team_slug} — 团队详情
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
 * PATCH /api/teams/{team_slug} — 更新团队设置
 * Body: { display_name?: string, bio?: string, avatar_url?: string, website_url?: string }
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
 * DELETE /api/teams/{team_slug} — 删除团队
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
