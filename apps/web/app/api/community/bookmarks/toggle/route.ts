import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { toggleBookmark } from '@/lib/services/community';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (
      (body.entity_type !== 'published_page' && body.entity_type !== 'moment') ||
      typeof body.entity_id !== 'string' ||
      !body.entity_id
    ) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: `Invalid bookmark payload: entity_type=${body.entity_type}, entity_id=${body.entity_id}` } },
        { status: 400 }
      );
    }

    const result = await toggleBookmark({
      entityType: body.entity_type,
      entityId: body.entity_id,
      session,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }

    console.error('[bookmarks/toggle] Error:', error instanceof Error ? error.message : error);

    const code = error instanceof Error ? error.message : 'internal_error';
    if (code === 'community_entity_not_found') {
      return NextResponse.json(
        { error: { code, message: 'Entity not found in community system. It may need to be published first.' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: { code, message: code } }, { status: 500 });
  }
}
