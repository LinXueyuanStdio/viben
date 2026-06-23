import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { deleteCommunityComment, updateCommunityComment } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ comment_id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { comment_id: commentId } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.content !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Invalid comment payload' } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await updateCommunityComment({
        commentId,
        content: body.content,
        session,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }

    const code = error instanceof Error ? error.message : 'internal_error';
    const status = code === 'permission_denied' ? 403 : code === 'comment_not_found' ? 404 : 400;
    return NextResponse.json({ error: { code, message: code } }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { comment_id: commentId } = await params;
    return NextResponse.json(
      await deleteCommunityComment({
        commentId,
        session,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'login_required', message: error.message } },
        { status: error.status }
      );
    }

    const code = error instanceof Error ? error.message : 'internal_error';
    const status = code === 'permission_denied' ? 403 : code === 'comment_not_found' ? 404 : 400;
    return NextResponse.json({ error: { code, message: code } }, { status });
  }
}
