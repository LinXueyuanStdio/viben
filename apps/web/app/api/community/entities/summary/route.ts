import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOptionalSession } from '@/lib/auth/middleware';
import { getCommunitySummary } from '@/lib/services/community';

/**
 * 获取实体摘要
 * @summary 获取实体摘要
 * @description 获取社区实体（published_page / moment / comment）的摘要信息，包含书签数、反应数、评论数等统计数据。通过 getOptionalSession 支持可选的用户会话以获取用户交互状态。实体不存在于社区系统时返回 404。
 * @params EntitySummaryQuery
 * @response 200:SuccessResponse:实体摘要信息
 * @response 400:ErrorResponse:不支持的实体类型或缺少 entity_id
 * @response 404:ErrorResponse:实体不存在
 * @tag Community
 */
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
  const summary = await getCommunitySummary(entityType, entityId, session);

  if (!summary) {
    return NextResponse.json(
      { error: { code: 'community_entity_not_found', message: 'Community entity not found' } },
      { status: 404 }
    );
  }

  return NextResponse.json(summary);
}
