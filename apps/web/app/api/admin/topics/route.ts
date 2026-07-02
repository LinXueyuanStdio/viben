/**
 * Admin Topics API
 *
 * GET /api/admin/topics - List topics (with pagination, search, and filter)
 * POST /api/admin/topics - Create a new topic
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, momentTopics } from '@/lib/db';
import { eq, desc, and, or, ilike, count, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listTopicsQuerySchema = z.object({
  filter: z.enum(['all', 'featured', 'blocked']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

const createTopicSchema = z.object({
  slug: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  is_featured: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'topics.manage');

    const searchParams = request.nextUrl.searchParams;
    const query = listTopicsQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, search, filter } = query;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (filter === 'featured') {
      conditions.push(eq(momentTopics.isFeatured, true));
    } else if (filter === 'blocked') {
      conditions.push(eq(momentTopics.isBlocked, true));
    }
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(momentTopics.displayName, searchPattern),
          ilike(momentTopics.slug, searchPattern)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(momentTopics)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const topics = await db
      .select()
      .from(momentTopics)
      .where(whereClause)
      .orderBy(desc(momentTopics.momentCount), desc(momentTopics.lastMomentAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      topics,
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
    console.error('List topics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'topics.manage');

    const body = await request.json();
    const data = createTopicSchema.parse(body);

    // Check for duplicate slug
    const [existing] = await db
      .select({ id: momentTopics.id })
      .from(momentTopics)
      .where(eq(momentTopics.slug, data.slug));
    if (existing) {
      return NextResponse.json(
        { error: '话题 slug 已存在' },
        { status: 409 }
      );
    }

    const [topic] = await db
      .insert(momentTopics)
      .values({
        slug: data.slug,
        displayName: data.display_name,
        description: data.description ?? null,
        isFeatured: data.is_featured,
      })
      .returning();

    return NextResponse.json({ topic }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create topic error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
