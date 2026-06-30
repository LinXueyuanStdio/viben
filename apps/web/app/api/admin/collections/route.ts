/**
 * Admin Collections API
 *
 * GET /api/admin/collections - List all collections for moderation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, collections, users } from '@/lib/db';
import { eq, desc, count, and, like, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listCollectionsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  visibility: z.enum(['all', 'public', 'private']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listCollectionsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, search, visibility } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (visibility === 'public') {
      conditions.push(eq(collections.isPublic, true));
    } else if (visibility === 'private') {
      conditions.push(eq(collections.isPublic, false));
    }
    if (search) {
      conditions.push(like(collections.name, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(collections)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const collectionList = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        isPublic: collections.isPublic,
        itemCount: collections.itemCount,
        forksCount: collections.forksCount,
        bookmarksCount: collections.bookmarksCount,
        createdAt: collections.createdAt,
        ownerId: collections.ownerId,
        ownerName: users.username,
        ownerDisplayName: users.displayName,
      })
      .from(collections)
      .innerJoin(users, eq(collections.ownerId, users.id))
      .where(whereClause)
      .orderBy(desc(collections.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      collections: collectionList,
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
    console.error('List admin collections error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
