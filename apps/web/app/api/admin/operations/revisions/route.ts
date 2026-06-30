/**
 * Admin Operations Revisions API
 *
 * GET /api/admin/operations/revisions - List operation revisions
 * Query params: surface (required), locale (required)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, operationRevisions } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

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
