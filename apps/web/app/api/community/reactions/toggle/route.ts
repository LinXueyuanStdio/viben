import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { toggleReaction } from '@/lib/services/community';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (
      (body.entity_type !== 'published_page' &&
        body.entity_type !== 'moment' &&
        body.entity_type !== 'comment') ||
      typeof body.entity_id !== 'string' ||
      (body.reaction_type !== undefined && body.reaction_type !== 'like')
    ) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Invalid reaction payload' } },
        { status: 400 }
      );
    }

    const result = await toggleReaction({
      entityType: body.entity_type,
      entityId: body.entity_id,
      reactionType: 'like',
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

    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: { code, message: code } }, { status: 400 });
  }
}
