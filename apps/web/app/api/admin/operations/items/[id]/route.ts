/**
 * Admin Operations Items [id] API
 *
 * PATCH /api/admin/operations/items/[id] - Update an item
 * DELETE /api/admin/operations/items/[id] - Delete an item
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, operationItems } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateItemSchema = z.object({
  uid: z.string().min(1).max(100).optional(),
  item_type: z.string().min(1).max(50).optional(),
  target_entity_type: z.string().max(50).nullable().optional(),
  target_entity_id: z.string().max(100).nullable().optional(),
  target_entity_uid: z.string().max(100).nullable().optional(),
  target_url: z.string().max(500).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(200).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  image_url: z.string().max(500).nullable().optional(),
  cta_label: z.string().max(50).nullable().optional(),
  badge_label: z.string().max(50).nullable().optional(),
  locale: z.string().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  visibility: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'operations.manage');

    const { id } = await params;
    const body = await request.json();
    const data = updateItemSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.uid !== undefined) updateData.uid = data.uid;
    if (data.item_type !== undefined) updateData.itemType = data.item_type;
    if (data.target_entity_type !== undefined) updateData.targetEntityType = data.target_entity_type;
    if (data.target_entity_id !== undefined) updateData.targetEntityId = data.target_entity_id;
    if (data.target_entity_uid !== undefined) updateData.targetEntityUid = data.target_entity_uid;
    if (data.target_url !== undefined) updateData.targetUrl = data.target_url;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.image_url !== undefined) updateData.imageUrl = data.image_url;
    if (data.cta_label !== undefined) updateData.ctaLabel = data.cta_label;
    if (data.badge_label !== undefined) updateData.badgeLabel = data.badge_label;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
    if (data.is_active !== undefined) updateData.isActive = data.is_active;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;
    if (data.starts_at !== undefined) updateData.startsAt = data.starts_at ? new Date(data.starts_at) : null;
    if (data.ends_at !== undefined) updateData.endsAt = data.ends_at ? new Date(data.ends_at) : null;

    const [item] = await db
      .update(operationItems)
      .set(updateData)
      .where(eq(operationItems.id, id))
      .returning();

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
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
    console.error('Update operation item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'operations.manage');

    const { id } = await params;

    await db.delete(operationItems).where(eq(operationItems.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete operation item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
