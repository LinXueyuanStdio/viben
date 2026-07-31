/**
 * Admin Operations Slot Items API
 *
 * GET /api/admin/operations/slots/[id]/items - List items in a slot
 * POST /api/admin/operations/slots/[id]/items - Create a new item in a slot
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, operationItems } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';

const createItemSchema = z.object({
  uid: z.string().min(1).max(100),
  item_type: z.string().min(1).max(50),
  target_entity_type: z.string().max(50).optional(),
  target_entity_id: z.string().max(100).optional(),
  target_entity_uid: z.string().max(100).optional(),
  target_url: z.string().max(500).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  image_url: z.string().max(500).optional(),
  cta_label: z.string().max(50).optional(),
  badge_label: z.string().max(50).optional(),
  locale: z.string().default('default'),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  visibility: z.enum(['draft', 'scheduled', 'published', 'archived']).default('draft'),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'operations.manage');

    const { id: slotId } = await params;

    const items = await db
      .select()
      .from(operationItems)
      .where(eq(operationItems.slotId, slotId))
      .orderBy(asc(operationItems.sortOrder));

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('List operation items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'operations.manage');

    const { id: slotId } = await params;
    const body = await request.json();
    const data = createItemSchema.parse(body);

    // Check for duplicate UID
    const [existingItem] = await db
      .select({ id: operationItems.id })
      .from(operationItems)
      .where(eq(operationItems.uid, data.uid));
    if (existingItem) {
      return NextResponse.json(
        { error: '条目 UID 已存在' },
        { status: 409 }
      );
    }

    const [item] = await db
      .insert(operationItems)
      .values({
        uid: data.uid,
        slotId,
        itemType: data.item_type,
        targetEntityType: data.target_entity_type ?? null,
        targetEntityId: data.target_entity_id ?? null,
        targetEntityUid: data.target_entity_uid ?? null,
        targetUrl: data.target_url ?? null,
        title: data.title,
        subtitle: data.subtitle ?? null,
        description: data.description ?? null,
        imageUrl: data.image_url ?? null,
        ctaLabel: data.cta_label ?? null,
        badgeLabel: data.badge_label ?? null,
        locale: data.locale,
        sortOrder: data.sort_order,
        isActive: data.is_active,
        visibility: data.visibility,
        startsAt: data.starts_at ? new Date(data.starts_at) : null,
        endsAt: data.ends_at ? new Date(data.ends_at) : null,
      })
      .returning();

    return NextResponse.json({ item }, { status: 201 });
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
    console.error('Create operation item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
