/**
 * Admin User Follows API
 *
 * GET /api/admin/users/[id]/follows - Get followers and followees for a user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, users, userFollows } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const followsQuerySchema = z.object({
  type: z.enum(['followers', 'followees']).default('followers'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id]/follows
 *
 * Returns followers or followees for a user, joined with usernames.
 *
 * Query parameters:
 * - type: 'followers' | 'followees' (default: 'followers')
 *
 * Required permission: users.view
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requirePermission(request, 'users.view');

    const { id } = await params;

    const searchParams = request.nextUrl.searchParams;
    const query = followsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    // Verify the target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (query.type === 'followees') {
      // Users that the target user follows
      const rows = await db
        .select({
          followeeId: userFollows.followeeUserId,
          notifyLevel: userFollows.notifyLevel,
          createdAt: userFollows.createdAt,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followeeUserId, users.id))
        .where(eq(userFollows.followerUserId, id))
        .orderBy(userFollows.createdAt);

      return NextResponse.json({
        follows: rows.map((row) => ({
          userId: row.followeeId,
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          notifyLevel: row.notifyLevel,
          createdAt: row.createdAt,
        })),
      });
    } else {
      // Users that follow the target user (followers)
      const rows = await db
        .select({
          followerId: userFollows.followerUserId,
          notifyLevel: userFollows.notifyLevel,
          createdAt: userFollows.createdAt,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followerUserId, users.id))
        .where(eq(userFollows.followeeUserId, id))
        .orderBy(userFollows.createdAt);

      return NextResponse.json({
        follows: rows.map((row) => ({
          userId: row.followerId,
          username: row.username,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          notifyLevel: row.notifyLevel,
          createdAt: row.createdAt,
        })),
      });
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Get user follows error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
