/**
 * Admin Drafts API
 *
 * GET /api/admin/drafts - List all drafts for management
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, drafts, users } from '@/lib/db';
import { eq, desc, count, and, or, like, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listDraftsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  package_type: z.enum(['mcp', 'skill', 'all']).default('all'),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.delete');

    const searchParams = request.nextUrl.searchParams;
    const query = listDraftsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, package_type, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (package_type !== 'all') {
      conditions.push(eq(drafts.packageType, package_type));
    }
    if (search) {
      const searchTerm: string = search;
      const searchCondition = or(
        like(users.username, `%${searchTerm}%`),
        like(users.displayName, `%${searchTerm}%`)
      );
      conditions.push(searchCondition!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const baseCountQuery = db
      .select({ count: count() })
      .from(drafts)
      .innerJoin(users, eq(drafts.userId, users.id));
    const [totalResult] = await (whereClause ? baseCountQuery.where(whereClause) : baseCountQuery);

    const total = totalResult?.count ?? 0;

    const draftList = await db
      .select({
        id: drafts.id,
        userId: drafts.userId,
        packageType: drafts.packageType,
        data: drafts.data,
        expiresAt: drafts.expiresAt,
        createdAt: drafts.createdAt,
        updatedAt: drafts.updatedAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(drafts)
      .innerJoin(users, eq(drafts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(drafts.createdAt))
      .limit(limit)
      .offset(offset);

    const enrichedDrafts = draftList.map((d) => ({
      id: d.id,
      packageType: d.packageType,
      expiresAt: d.expiresAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      dataPreview: getDataPreview(d.data as Record<string, unknown> | null),
      user: {
        id: d.userId,
        username: d.username,
        displayName: d.displayName,
        avatarUrl: d.avatarUrl,
      },
    }));

    return NextResponse.json({
      drafts: enrichedDrafts,
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
    console.error('List admin drafts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getDataPreview(data: Record<string, unknown> | null): string {
  if (!data || typeof data !== 'object') return 'No data';
  // Try to extract a name or title for preview
  if (typeof data.name === 'string') return data.name;
  if (typeof data.title === 'string') return data.title;
  if (typeof data.description === 'string' && data.description.length > 0) {
    return data.description.length > 80
      ? `${data.description.slice(0, 80)}...`
      : data.description;
  }
  const keys = Object.keys(data);
  if (keys.length > 0) {
    return `JSON { ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} }`;
  }
  return 'Empty data';
}
