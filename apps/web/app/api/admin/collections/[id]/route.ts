/**
 * Admin Collection Detail API
 *
 * GET /api/admin/collections/[id] - Get collection details with items
 * PATCH /api/admin/collections/[id] - Update collection name/description/visibility
 * DELETE /api/admin/collections/[id] - Delete a collection
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, collections, collectionItems, mcpPackages, skillPackages, users } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createModerationLog } from '@/lib/admin/logs';

// ============================================
// PATCH Schema
// ============================================

const patchCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  isPublic: z.boolean().optional(),
});

// ============================================
// GET /api/admin/collections/[id]
// ============================================

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'content.moderate');
    const { id } = await params;

    // Fetch collection with owner info
    const collection = await db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        isPublic: collections.isPublic,
        itemCount: collections.itemCount,
        forksCount: collections.forksCount,
        bookmarksCount: collections.bookmarksCount,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
        forkedFromId: collections.forkedFromId,
        ownerId: collections.ownerId,
        ownerName: users.username,
        ownerDisplayName: users.displayName,
      })
      .from(collections)
      .innerJoin(users, eq(collections.ownerId, users.id))
      .where(eq(collections.id, id))
      .limit(1);

    if (collection.length === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const col = collection[0];

    // Fetch collection items
    const items = await db
      .select({
        id: collectionItems.id,
        itemId: collectionItems.itemId,
        itemType: collectionItems.itemType,
        note: collectionItems.note,
        position: collectionItems.position,
        addedAt: collectionItems.addedAt,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, id))
      .orderBy(collectionItems.position);

    // Batch resolve item names from mcpPackages and skillPackages
    const mcpIds = items.filter((i) => i.itemType === 'mcp').map((i) => i.itemId);
    const skillIds = items.filter((i) => i.itemType === 'skill').map((i) => i.itemId);

    const itemNameMap = new Map<string, { name: string; slug: string }>();

    if (mcpIds.length > 0) {
      const mcpResults = await db
        .select({ id: mcpPackages.id, name: mcpPackages.name, slug: mcpPackages.slug })
        .from(mcpPackages)
        .where(inArray(mcpPackages.id, mcpIds));
      for (const pkg of mcpResults) {
        itemNameMap.set(pkg.id, { name: pkg.name, slug: pkg.slug });
      }
    }

    if (skillIds.length > 0) {
      const skillResults = await db
        .select({ id: skillPackages.id, name: skillPackages.name, slug: skillPackages.slug })
        .from(skillPackages)
        .where(inArray(skillPackages.id, skillIds));
      for (const pkg of skillResults) {
        itemNameMap.set(pkg.id, { name: pkg.name, slug: pkg.slug });
      }
    }

    // Enrich items with names
    const enrichedItems = items.map((item) => {
      const resolved = itemNameMap.get(item.itemId);
      return {
        id: item.id,
        itemId: item.itemId,
        itemType: item.itemType,
        itemName: resolved?.name ?? `Unknown ${item.itemId.slice(0, 8)}`,
        itemSlug: resolved?.slug ?? null,
        note: item.note,
        position: item.position,
        addedAt: item.addedAt,
      };
    });

    return NextResponse.json({
      collection: col,
      items: enrichedItems,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get collection detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PATCH /api/admin/collections/[id]
// ============================================

/** @ignore */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.moderate');
    const { id } = await params;

    const body = await request.json();
    const parsed = patchCollectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check collection exists
    const existing = await db.query.collections.findFirst({
      where: eq(collections.id, id),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const changes: string[] = [];

    if (parsed.data.name !== undefined && parsed.data.name !== existing.name) {
      updates.name = parsed.data.name;
      changes.push(`name: "${existing.name}" -> "${parsed.data.name}"`);
    }
    if (parsed.data.description !== undefined && parsed.data.description !== existing.description) {
      updates.description = parsed.data.description;
      changes.push(`description updated`);
    }
    if (parsed.data.isPublic !== undefined && parsed.data.isPublic !== existing.isPublic) {
      updates.isPublic = parsed.data.isPublic;
      changes.push(`visibility: ${existing.isPublic ? 'public' : 'private'} -> ${parsed.data.isPublic ? 'public' : 'private'}`);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes' });
    }

    await db.update(collections).set(updates).where(eq(collections.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'collection',
      entityId: id,
      action: 'edit',
      reason: changes.join('; '),
    });

    return NextResponse.json({ success: true });
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
    console.error('Patch collection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE /api/admin/collections/[id]
// ============================================

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.moderate');
    const { id } = await params;

    const collection = await db.query.collections.findFirst({
      where: eq(collections.id, id),
    });

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    await db.delete(collections).where(eq(collections.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: 'collection',
      entityId: id,
      action: 'delete',
      reason: `Deleted collection: ${collection.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete collection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
