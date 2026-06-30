/**
 * Admin Categories [id] API
 *
 * PATCH /api/admin/categories/[id] - Update a category
 * DELETE /api/admin/categories/[id] - Delete a category
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, pageCategories } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateCategorySchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.any().nullable().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'categories.manage');

    const { id } = await params;
    const body = await request.json();
    const data = updateCategorySchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
    if (data.is_active !== undefined) updateData.isActive = data.is_active;

    const [category] = await db
      .update(pageCategories)
      .set(updateData)
      .where(eq(pageCategories.id, id))
      .returning();

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
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
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'categories.manage');

    const { id } = await params;

    await db.delete(pageCategories).where(eq(pageCategories.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
