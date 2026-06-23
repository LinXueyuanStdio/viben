import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, getOptionalSession, requireAuth } from '@/lib/auth/middleware';
import { createCommunityComment, listCommunityComments } from '@/lib/services/community';

function toLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');

  if (
    (entityType !== 'published_page' && entityType !== 'moment' && entityType !== 'comment') ||
    !entityId
  ) {
    return NextResponse.json(
      { error: { code: 'unsupported_entity_type', message: 'Unsupported entity_type or missing entity_id' } },
      { status: 400 }
    );
  }

  const session = await getOptionalSession(request);
  const result = await listCommunityComments({
    entityType,
    entityId,
    parentCommentId: searchParams.get('parent_comment_id'),
    limit: toLimit(searchParams.get('limit'), 20, 100),
    session,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (
      (body.entity_type !== 'published_page' && body.entity_type !== 'moment') ||
      typeof body.entity_id !== 'string' ||
      typeof body.content !== 'string'
    ) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Invalid comment payload' } },
        { status: 400 }
      );
    }

    const comment = await createCommunityComment({
      entityType: body.entity_type,
      entityId: body.entity_id,
      parentCommentId:
        typeof body.parent_comment_id === 'string' ? body.parent_comment_id : null,
      content: body.content,
      session,
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        status: comment.status,
        depth: comment.depth,
        parent_comment_id: comment.parentCommentId,
        created_at: comment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }

    const code = error instanceof Error ? error.message : 'internal_error';
    const status = code === 'community_entity_not_found' ? 404 : 400;
    return NextResponse.json({ error: { code, message: code } }, { status });
  }
}
