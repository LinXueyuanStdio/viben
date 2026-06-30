/**
 * Admin API Keys [id] API
 *
 * DELETE /api/admin/api-keys/[id] - Revoke (delete) an API key
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { getSession } from '@/lib/auth';
import { db, apiKeys } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createModerationLog } from '@/lib/admin/logs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission(request, 'users.ban');
    const { id } = await params;

    const [key] = await db
      .select({ name: apiKeys.name, userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.id, id));

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    if (key && session.userId) {
      await createModerationLog({
        adminId: session.userId,
        entityType: 'user',
        entityId: key.userId,
        action: 'warn',
        reason: `Revoked API key: ${key.name}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Revoke API key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
