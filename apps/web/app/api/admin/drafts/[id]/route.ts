/**
 * Admin Draft Detail & Delete API
 *
 * GET /api/admin/drafts/[id] - Get draft detail
 * DELETE /api/admin/drafts/[id] - Delete a draft
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, drafts, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, 'content.delete');
    const { id } = await params;

    const results = await db
      .select({
        id: drafts.id,
        userId: drafts.userId,
        packageType: drafts.packageType,
        data: drafts.data,
        createdAt: drafts.createdAt,
        updatedAt: drafts.updatedAt,
        expiresAt: drafts.expiresAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(drafts)
      .innerJoin(users, eq(drafts.userId, users.id))
      .where(eq(drafts.id, id))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const d = results[0];
    return NextResponse.json({
      draft: {
        id: d.id,
        packageType: d.packageType,
        data: d.data,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        expiresAt: d.expiresAt,
        user: {
          id: d.userId,
          username: d.username,
          displayName: d.displayName,
          avatarUrl: d.avatarUrl,
        },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get draft error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @ignore */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'content.delete');
    const { id } = await params;

    const draft = await db.query.drafts.findFirst({
      where: eq(drafts.id, id),
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await db.delete(drafts).where(eq(drafts.id, id));

    await createModerationLog({
      adminId: session.userId,
      entityType: draft.packageType as 'mcp' | 'skill',
      entityId: id,
      action: 'delete',
      reason: `Deleted ${draft.packageType} draft by user ${draft.userId}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete draft error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
