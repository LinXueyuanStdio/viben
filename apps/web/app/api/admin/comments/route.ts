/**
 * Admin Comments API
 *
 * GET /api/admin/comments - List all comments for moderation
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, comments, users, mcpPackages, skillPackages, collections } from '@/lib/db';
import { eq, desc, count, and, like, inArray, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listCommentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  entity_type: z.enum(['mcp', 'skill', 'collection', 'all']).default('all'),
  search: z.string().optional(),
});

/** @ignore */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'content.moderate');

    const searchParams = request.nextUrl.searchParams;
    const query = listCommentsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, entity_type, search } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (entity_type !== 'all') {
      conditions.push(eq(comments.entityType, entity_type));
    }
    if (search) {
      conditions.push(like(comments.content, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(comments)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const commentList = await db
      .select({
        id: comments.id,
        entityType: comments.entityType,
        entityId: comments.entityId,
        content: comments.content,
        createdAt: comments.createdAt,
        userId: comments.userId,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(whereClause)
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch resolve entity names
    const entityNames = await resolveEntityNames(commentList);

    const enrichedComments = commentList.map((c) => ({
      id: c.id,
      entityType: c.entityType,
      entityId: c.entityId,
      entityName: entityNames.get(`${c.entityType}:${c.entityId}`) || 'Unknown',
      content: c.content,
      createdAt: c.createdAt,
      user: {
        id: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
      },
    }));

    return NextResponse.json({
      comments: enrichedComments,
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
    console.error('List admin comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function resolveEntityNames(
  commentList: Array<{ entityType: string; entityId: string }>
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const mcpIds = [...new Set(commentList.filter(c => c.entityType === 'mcp').map(c => c.entityId))];
  const skillIds = [...new Set(commentList.filter(c => c.entityType === 'skill').map(c => c.entityId))];
  const collectionIds = [...new Set(commentList.filter(c => c.entityType === 'collection').map(c => c.entityId))];

  if (mcpIds.length > 0) {
    const pkgs = await db.select({ id: mcpPackages.id, name: mcpPackages.name })
      .from(mcpPackages).where(inArray(mcpPackages.id, mcpIds));
    for (const p of pkgs) map.set(`mcp:${p.id}`, p.name);
  }
  for (const id of mcpIds) {
    if (!map.has(`mcp:${id}`)) map.set(`mcp:${id}`, `MCP ${id.slice(0, 8)}`);
  }

  if (skillIds.length > 0) {
    const pkgs = await db.select({ id: skillPackages.id, name: skillPackages.name })
      .from(skillPackages).where(inArray(skillPackages.id, skillIds));
    for (const p of pkgs) map.set(`skill:${p.id}`, p.name);
  }
  for (const id of skillIds) {
    if (!map.has(`skill:${id}`)) map.set(`skill:${id}`, `Skill ${id.slice(0, 8)}`);
  }

  if (collectionIds.length > 0) {
    const cols = await db.select({ id: collections.id, name: collections.name })
      .from(collections).where(inArray(collections.id, collectionIds));
    for (const c of cols) map.set(`collection:${c.id}`, c.name);
  }
  for (const id of collectionIds) {
    if (!map.has(`collection:${id}`)) map.set(`collection:${id}`, `Collection ${id.slice(0, 8)}`);
  }

  return map;
}
