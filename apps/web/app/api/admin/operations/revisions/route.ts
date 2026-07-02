/**
 * Admin Operations Revisions API
 *
 * GET /api/admin/operations/revisions - List operation revisions
 * Query params: surface (required), locale (required)
 *
 * POST /api/admin/operations/revisions - Create a new revision snapshot
 * Body: { surface: string, locale: string }
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, operationRevisions, operationSlots, operationItems } from '@/lib/db';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

const createRevisionSchema = z.object({
  surface: z.string().min(1).max(100),
  locale: z.string().min(1).max(50).default('default'),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'operations.manage');

    const { searchParams } = new URL(request.url);
    const surface = searchParams.get('surface');
    const locale = searchParams.get('locale');

    if (!surface || !locale) {
      return NextResponse.json(
        { error: 'surface 和 locale 参数为必填项' },
        { status: 400 }
      );
    }

    const revisions = await db
      .select({
        id: operationRevisions.id,
        uid: operationRevisions.uid,
        surface: operationRevisions.surface,
        locale: operationRevisions.locale,
        revisionNumber: operationRevisions.revisionNumber,
        status: operationRevisions.status,
        publishedAt: operationRevisions.publishedAt,
        publishedBy: operationRevisions.publishedBy,
        createdBy: operationRevisions.createdBy,
        createdAt: operationRevisions.createdAt,
      })
      .from(operationRevisions)
      .where(
        and(
          eq(operationRevisions.surface, surface),
          eq(operationRevisions.locale, locale)
        )
      )
      .orderBy(desc(operationRevisions.revisionNumber));

    return NextResponse.json({ revisions });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('List operation revisions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'operations.manage');

    const body = await request.json();
    const data = createRevisionSchema.parse(body);

    // Fetch all slots for this surface + locale
    const slots = await db
      .select()
      .from(operationSlots)
      .where(
        and(
          eq(operationSlots.surface, data.surface),
          eq(operationSlots.locale, data.locale)
        )
      )
      .orderBy(asc(operationSlots.sortOrder));

    // Fetch all items for each slot
    const snapshotSlots = await Promise.all(
      slots.map(async (slot) => {
        const items = await db
          .select()
          .from(operationItems)
          .where(eq(operationItems.slotId, slot.id))
          .orderBy(asc(operationItems.sortOrder));
        return { ...slot, items };
      })
    );

    // Determine next revision number
    const [latestRevision] = await db
      .select({ revisionNumber: operationRevisions.revisionNumber })
      .from(operationRevisions)
      .where(
        and(
          eq(operationRevisions.surface, data.surface),
          eq(operationRevisions.locale, data.locale)
        )
      )
      .orderBy(desc(operationRevisions.revisionNumber))
      .limit(1);

    const nextRevisionNumber = (latestRevision?.revisionNumber ?? 0) + 1;

    // Create revision
    const uid = `rev_${data.surface}_${data.locale}_${nextRevisionNumber}_${crypto.randomUUID().slice(0, 8)}`;

    const [revision] = await db
      .insert(operationRevisions)
      .values({
        uid,
        surface: data.surface,
        locale: data.locale,
        revisionNumber: nextRevisionNumber,
        status: 'draft',
        snapshot: { slots: snapshotSlots },
      })
      .returning();

    return NextResponse.json({ revision }, { status: 201 });
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
    console.error('Create operation revision error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
