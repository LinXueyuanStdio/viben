/**
 * Admin Operations Slots [id] API
 *
 * PATCH /api/admin/operations/slots/[id] - Update a slot
 * DELETE /api/admin/operations/slots/[id] - Delete a slot
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, operationSlots } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSlotSchema = z.object({
  uid: z.string().min(1).max(100).optional(),
  surface: z.string().min(1).max(100).optional(),
  slot_key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  layout_type: z.string().min(1).max(50).optional(),
  locale: z.string().optional(),
  min_items: z.coerce.number().int().min(0).optional(),
  max_items: z.coerce.number().int().min(1).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  fallback_strategy: z.string().optional(),
});

/** @ignore */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'operations.manage');

    const { id } = await params;
    const body = await request.json();
    const data = updateSlotSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.uid !== undefined) updateData.uid = data.uid;
    if (data.surface !== undefined) updateData.surface = data.surface;
    if (data.slot_key !== undefined) updateData.slotKey = data.slot_key;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.layout_type !== undefined) updateData.layoutType = data.layout_type;
    if (data.locale !== undefined) updateData.locale = data.locale;
    if (data.min_items !== undefined) updateData.minItems = data.min_items;
    if (data.max_items !== undefined) updateData.maxItems = data.max_items;
    if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
    if (data.is_active !== undefined) updateData.isActive = data.is_active;
    if (data.fallback_strategy !== undefined) updateData.fallbackStrategy = data.fallback_strategy;

    const [slot] = await db
      .update(operationSlots)
      .set(updateData)
      .where(eq(operationSlots.id, id))
      .returning();

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    return NextResponse.json({ slot });
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
    console.error('Update operation slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'operations.manage');

    const { id } = await params;

    await db.delete(operationSlots).where(eq(operationSlots.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete operation slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
