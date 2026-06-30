/**
 * Admin Topics API
 *
 * GET /api/admin/topics - List topics
 * POST /api/admin/topics - Create a new topic
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, momentTopics } from '@/lib/db';
import { eq, desc, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listTopicsQuerySchema = z.object({
  filter: z.enum(['all', 'featured', 'blocked']).default('all'),
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

    const conditions: SQL[] = [];
    if (query.filter === 'featured') {
      conditions.push(eq(momentTopics.isFeatured, true));
    } else if (query.filter === 'blocked') {
      conditions.push(eq(momentTopics.isBlocked, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const topics = await db
      .select()
      .from(momentTopics)
      .where(whereClause)
      .orderBy(desc(momentTopics.momentCount), desc(momentTopics.lastMomentAt));

    return NextResponse.json({ topics });
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
