/**
 * Admin Operations Slots API
 *
 * GET /api/admin/operations/slots - List operation slots
 * POST /api/admin/operations/slots - Create a new operation slot
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, operationSlots } from '@/lib/db';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';

const createSlotSchema = z.object({
  uid: z.string().min(1).max(100),
  surface: z.string().min(1).max(100),
  slot_key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  layout_type: z.string().min(1).max(50),
  locale: z.string().default('default'),
  min_items: z.coerce.number().int().min(0).default(0),
  max_items: z.coerce.number().int().min(1).default(10),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  fallback_strategy: z.string().default('none'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'operations.manage');

    const slots = await db
      .select()
      .from(operationSlots)
      .orderBy(asc(operationSlots.sortOrder), asc(operationSlots.name));

    return NextResponse.json({ slots });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('List operation slots error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'operations.manage');

    const body = await request.json();
    const data = createSlotSchema.parse(body);

    // Check for duplicate UID
    const [existingSlot] = await db
      .select({ id: operationSlots.id })
      .from(operationSlots)
      .where(eq(operationSlots.uid, data.uid));
    if (existingSlot) {
      return NextResponse.json(
        { error: '运营位 UID 已存在' },
        { status: 409 }
      );
    }

    const [slot] = await db
      .insert(operationSlots)
      .values({
        uid: data.uid,
        surface: data.surface,
        slotKey: data.slot_key,
        name: data.name,
        description: data.description ?? null,
        layoutType: data.layout_type,
        locale: data.locale,
        minItems: data.min_items,
        maxItems: data.max_items,
        sortOrder: data.sort_order,
        isActive: data.is_active,
        fallbackStrategy: data.fallback_strategy,
      })
      .returning();

    return NextResponse.json({ slot }, { status: 201 });
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
    console.error('Create operation slot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
