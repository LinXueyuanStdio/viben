/**
 * Admin Draft Delete API
 *
 * DELETE /api/admin/drafts/[id] - Delete a draft
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, drafts } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

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
