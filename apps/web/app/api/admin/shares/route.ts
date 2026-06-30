/**
 * Admin Shares API
 *
 * GET /api/admin/shares - List all share links with pagination
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, shareLinks, users } from '@/lib/db';
import { eq, desc, count, and, isNull, isNotNull, or, lt } from 'drizzle-orm';
import { z } from 'zod';

const listSharesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['all', 'active', 'expired', 'revoked']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listSharesQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, status } = query;
    const offset = (page - 1) * limit;

    // Build where condition based on status filter
    let statusCondition = undefined;
    if (status === 'active') {
      // Not revoked AND (no expiry OR not yet expired)
      statusCondition = and(
        isNull(shareLinks.revokedAt),
        or(
          isNull(shareLinks.expiresAt),
          lt(new Date(), shareLinks.expiresAt!)
        )
      );
    } else if (status === 'expired') {
      // Not revoked AND expired (has expiry date AND it has passed)
      statusCondition = and(
        isNull(shareLinks.revokedAt),
        isNotNull(shareLinks.expiresAt),
        lt(shareLinks.expiresAt!, new Date())
      );
    } else if (status === 'revoked') {
      statusCondition = isNotNull(shareLinks.revokedAt);
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(shareLinks)
      .where(statusCondition ?? and());

    const total = totalResult?.count ?? 0;

    const shareList = await db
      .select({
        id: shareLinks.id,
        uid: shareLinks.uid,
        entityType: shareLinks.entityType,
        entityId: shareLinks.entityId,
        channel: shareLinks.channel,
        targetUrl: shareLinks.targetUrl,
        htmlDirectUrl: shareLinks.htmlDirectUrl,
        expiresAt: shareLinks.expiresAt,
        revokedAt: shareLinks.revokedAt,
        openCount: shareLinks.openCount,
        uniqueOpenCount: shareLinks.uniqueOpenCount,
        createdAt: shareLinks.createdAt,
        createdByUserId: shareLinks.createdByUserId,
        createdByUsername: users.username,
        createdByDisplayName: users.displayName,
      })
      .from(shareLinks)
      .leftJoin(users, eq(shareLinks.createdByUserId, users.id))
      .where(statusCondition ?? and())
      .orderBy(desc(shareLinks.createdAt))
      .limit(limit)
      .offset(offset);

    const shares = shareList.map((s) => {
      let statusLabel: 'active' | 'expired' | 'revoked' = 'active';
      if (s.revokedAt) {
        statusLabel = 'revoked';
      } else if (s.expiresAt && new Date(s.expiresAt) <= new Date()) {
        statusLabel = 'expired';
      }

      return {
        id: s.id,
        uid: s.uid,
        entityType: s.entityType,
        entityId: s.entityId,
        channel: s.channel,
        targetUrl: s.targetUrl,
        htmlDirectUrl: s.htmlDirectUrl,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        openCount: s.openCount,
        uniqueOpenCount: s.uniqueOpenCount,
        createdAt: s.createdAt,
        status: statusLabel,
        createdBy: s.createdByUserId
          ? {
              userId: s.createdByUserId,
              username: s.createdByUsername,
              displayName: s.createdByDisplayName,
            }
          : null,
      };
    });

    return NextResponse.json({
      shares,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
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
    console.error('List admin shares error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
