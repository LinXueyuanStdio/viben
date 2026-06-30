/**
 * Admin Topics [id] API
 *
 * PATCH /api/admin/topics/[id] - Update a topic
 * DELETE /api/admin/topics/[id] - Delete a topic
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, momentTopics } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateTopicSchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  is_featured: z.boolean().optional(),
  is_blocked: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'topics.manage');

    const { id } = await params;
    const body = await request.json();
    const data = updateTopicSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.display_name !== undefined) updateData.displayName = data.display_name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_featured !== undefined) updateData.isFeatured = data.is_featured;
    if (data.is_blocked !== undefined) updateData.isBlocked = data.is_blocked;

    const [topic] = await db
      .update(momentTopics)
      .set(updateData)
      .where(eq(momentTopics.id, id))
      .returning();

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json({ topic });
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
    console.error('Update topic error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'topics.manage');

    const { id } = await params;

    await db.delete(momentTopics).where(eq(momentTopics.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete topic error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
