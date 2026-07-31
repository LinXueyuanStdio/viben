import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { deleteCommunityComment, updateCommunityComment, toggleReaction } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ comment_id: string }>;
}

/**
 * 更新评论或切换评论反应
 * @summary 更新评论或切换反应
 * @description 更新评论内容（传入 content）或对评论切换反应（传入 reaction: true），仅评论作者可编辑内容。权限检查在服务层进行：非作者编辑返回 403，评论不存在返回 404。
 * @pathParams CommentIdParams
 * @body UpdateCommentBody
 * @response 200:SuccessResponse:更新成功
 * @response 400:ErrorResponse:请求参数无效
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:权限不足
 * @response 404:ErrorResponse:评论不存在
 * @responseSet auth
 * @auth bearer
 * @tag Community
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { comment_id: commentId } = await params;
    const body = await request.json().catch(() => ({}));

    // Handle reaction toggle
    if (body.reaction === true) {
      return NextResponse.json(
        await toggleReaction({
          entityType: 'comment',
          entityId: commentId,
          reactionType: 'like',
          session,
        })
      );
    }

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

/**
 * 删除评论
 * @summary 删除评论
 * @description 删除指定评论，仅评论作者可删除自己的评论。权限检查在服务层进行：非作者删除返回 403，评论不存在返回 404。
 * @pathParams CommentIdParams
 * @response 200:SuccessResponse:删除成功
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:权限不足
 * @response 404:ErrorResponse:评论不存在
 * @responseSet auth
 * @auth bearer
 * @tag Community
 */
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
