import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, getOptionalSession, requireAuth } from '@/lib/auth/middleware';
import { createCommunityComment, listCommunityComments } from '@/lib/services/community';

function toLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

/**
 * 获取评论列表
 * @summary 获取评论列表
 * @description 获取指定实体的评论列表，支持按父评论过滤和游标分页。实体类型支持 published_page、moment、comment。支持可选登录（通过 getOptionalSession），登录后可获取用户对评论的交互状态。
 * @params CommunityCommentsQuery
 * @response 200:CommentListResponse:评论列表数据
 * @response 400:ErrorResponse:不支持的实体类型或缺少 entity_id
 * @tag Community
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');

  if (
    (entityType !== 'published_page' && entityType !== 'moment' && entityType !== 'comment' && entityType !== 'project') ||
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
    cursor: searchParams.get('cursor'),
    session,
  });

  return NextResponse.json(result);
}

/**
 * 创建评论
 * @summary 创建评论
 * @description 对指定实体创建评论，支持回复其他评论（通过 parent_comment_id）。实体类型仅支持 published_page 和 moment。需登录（requireAuth），AuthError 时返回 login_required。成功后返回创建的评论对象。
 * @body CreateCommentBody
 * @response 200:CommentCreateResponse:评论创建成功
 * @response 400:ErrorResponse:参数无效或实体不存在
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Community
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    if (
      (body.entity_type !== 'published_page' && body.entity_type !== 'moment' && body.entity_type !== 'project') ||
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
        typeof body.parent_comment_id === 'string' && body.parent_comment_id ? body.parent_comment_id : null,
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
