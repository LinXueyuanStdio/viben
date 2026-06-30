/**
 * Admin User Detail API
 *
 * GET /api/admin/users/[id] - Get user detail with related data
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import {
  db,
  users,
  oauthConnections,
  apiKeys,
  userFollows,
  pageSubscriptions,
  drafts,
  publishedPages,
  userBrowseHistory,
  moderationLogs,
} from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id]
 *
 * Returns detailed information about a user including:
 * - OAuth connections
 * - API keys count
 * - Followers count
 * - Followees count
 * - Page subscriptions count
 * - Drafts count
 * - Published pages count
 * - Recent browse history (last 10)
 * - Moderation log entries for this user
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

    // Fetch user
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Run all queries in parallel
    const [
      oauthList,
      apiKeyCountResult,
      followersCountResult,
      followeesCountResult,
      subscriptionsCountResult,
      draftsCountResult,
      publishedPagesList,
      browseHistory,
      moderationEntries,
    ] = await Promise.all([
      // OAuth connections
      db
        .select({
          id: oauthConnections.id,
          provider: oauthConnections.provider,
          createdAt: oauthConnections.createdAt,
        })
        .from(oauthConnections)
        .where(eq(oauthConnections.userId, id)),

      // API keys count
      db.$count(apiKeys, eq(apiKeys.userId, id)),

      // Followers count (users following this user)
      db.$count(userFollows, eq(userFollows.followeeUserId, id)),

      // Followees count (users this user follows)
      db.$count(userFollows, eq(userFollows.followerUserId, id)),

      // Page subscriptions count
      db.$count(pageSubscriptions, eq(pageSubscriptions.userId, id)),

      // Drafts count
      db.$count(drafts, eq(drafts.userId, id)),

      // Published pages
      db
        .select({
          id: publishedPages.id,
          uid: publishedPages.uid,
          title: publishedPages.title,
          visibility: publishedPages.visibility,
          moderationStatus: publishedPages.moderationStatus,
          publishedAt: publishedPages.publishedAt,
          viewCount: publishedPages.viewCount,
        })
        .from(publishedPages)
        .where(eq(publishedPages.userId, id))
        .orderBy(desc(publishedPages.publishedAt))
        .limit(10),

      // Recent browse history (last 10)
      db
        .select({
          id: userBrowseHistory.id,
          entityType: userBrowseHistory.entityType,
          entityId: userBrowseHistory.entityId,
          lastViewedAt: userBrowseHistory.lastViewedAt,
          viewCount: userBrowseHistory.viewCount,
          snapshotTitle: userBrowseHistory.snapshotTitle,
        })
        .from(userBrowseHistory)
        .where(eq(userBrowseHistory.userId, id))
        .orderBy(desc(userBrowseHistory.lastViewedAt))
        .limit(10),

      // Moderation logs for this user (where entityType = 'user')
      db
        .select({
          id: moderationLogs.id,
          adminId: moderationLogs.adminId,
          action: moderationLogs.action,
          reason: moderationLogs.reason,
          metadata: moderationLogs.metadata,
          createdAt: moderationLogs.createdAt,
        })
        .from(moderationLogs)
        .where(
          eq(moderationLogs.entityType, 'user'),
          eq(moderationLogs.entityId, id)
        )
        .orderBy(desc(moderationLogs.createdAt))
        .limit(20),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        bio: user.bio,
        websiteUrl: user.websiteUrl,
        githubUsername: user.githubUsername,
        emailVerified: user.emailVerified,
        followersCount: user.followersCount,
        pageCount: user.pageCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
        warnedAt: user.warnedAt,
        warnedReason: user.warnedReason,
      },
      oauthConnections: oauthList,
      apiKeysCount: apiKeyCountResult,
      followersCount: followersCountResult,
      followeesCount: followeesCountResult,
      pageSubscriptionsCount: subscriptionsCountResult,
      draftsCount: draftsCountResult,
      publishedPagesCount: publishedPagesList.length,
      publishedPages: publishedPagesList,
      recentBrowseHistory: browseHistory,
      moderationLogs: moderationEntries,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get user detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
