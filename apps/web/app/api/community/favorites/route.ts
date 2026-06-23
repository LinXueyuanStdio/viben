import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { listCommunityFavorites } from '@/lib/services/community';

function toLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const rawEntityType = searchParams.get('entity_type');
    const entityType =
      rawEntityType === 'published_page' || rawEntityType === 'moment'
        ? rawEntityType
        : undefined;

    return NextResponse.json(
      await listCommunityFavorites({
        session,
        entityType,
        limit: toLimit(searchParams.get('limit'), 30, 100),
        cursor: searchParams.get('cursor'),
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'internal_error' } },
      { status: 500 }
    );
  }
}
