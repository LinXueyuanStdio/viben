/**
 * Admin Categories API
 *
 * GET /api/admin/categories - List categories
 * POST /api/admin/categories - Create a new category
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, pageCategories } from '@/lib/db';
import { eq, asc, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listCategoriesQuerySchema = z.object({
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

const createCategorySchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  icon: z.any().optional(),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'categories.manage');

    const searchParams = request.nextUrl.searchParams;
    const query = listCategoriesQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const conditions: SQL[] = [];
    if (query.status === 'active') {
      conditions.push(eq(pageCategories.isActive, true));
    } else if (query.status === 'inactive') {
      conditions.push(eq(pageCategories.isActive, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const categories = await db
      .select()
      .from(pageCategories)
      .where(whereClause)
      .orderBy(asc(pageCategories.sortOrder), asc(pageCategories.name));

    return NextResponse.json({ categories });
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
    console.error('List categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'categories.manage');

    const body = await request.json();
    const data = createCategorySchema.parse(body);

    const [category] = await db
      .insert(pageCategories)
      .values({
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        sortOrder: data.sort_order,
        isActive: data.is_active,
      })
      .returning();

    return NextResponse.json({ category }, { status: 201 });
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
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
