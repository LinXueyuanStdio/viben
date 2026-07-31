import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listRanking } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ ranking_key: string }>;
}

/**
 * 获取单个榜单详情
 * @summary 获取榜单详情
 * @description 根据榜单 key（路径参数 ranking_key）拉取完整榜单数据，支持 time_window（时间窗口，默认 7d）和 limit（每页条数，默认 30 最大 100）查询参数
 * @pathParams RankingKeyParams — 榜单标识
 * @params RankingDetailQuery
 * @response 200:RankingResponse:榜单详情数据
 * @tag Rankings
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { ranking_key: rankingKey } = await params;
  const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
  return NextResponse.json(
    await listRanking({
      rankingKey,
      timeWindow: request.nextUrl.searchParams.get('time_window') ?? '7d',
      limit,
    })
  );
}
