/**
 * Admin API Keys API
 *
 * GET /api/admin/api-keys - List API keys for admin overview
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, apiKeys, users } from '@/lib/db';
import { eq, desc, count, and, or, gt, lte, isNull, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['all', 'active', 'expired', 'permanent']).default('all'),
});

function buildStatusFilter(status: string) {
  if (status === 'active') {
    return or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, sql`NOW()`));
  }
  if (status === 'expired') {
    return and(isNotNull(apiKeys.expiresAt), lte(apiKeys.expiresAt, sql`NOW()`));
  }
  if (status === 'permanent') {
    return isNull(apiKeys.expiresAt);
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'users.view');

    const searchParams = request.nextUrl.searchParams;
    const query = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const offset = (query.page - 1) * query.limit;

    const statusFilter = buildStatusFilter(query.status);

    const [totalResult] = await db
      .select({ count: count() })
      .from(apiKeys)
      .where(statusFilter ?? undefined);

    const total = totalResult?.count ?? 0;

    const list = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        userId: apiKeys.userId,
        username: users.username,
      })
      .from(apiKeys)
      .leftJoin(users, eq(users.id, apiKeys.userId))
      .where(statusFilter ?? undefined)
      .orderBy(desc(apiKeys.createdAt))
      .limit(query.limit)
      .offset(offset);

    return NextResponse.json({
      apiKeys: list,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 });
    }
    console.error('List admin API keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
