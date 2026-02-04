import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';

// DELETE - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    // Find the key and verify ownership
    const key = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, session.userId)),
    });

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
