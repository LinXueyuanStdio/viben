import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listRanking } from '@/lib/services/community';

/**
 * 获取榜单列表
 * @summary 获取榜单数据
 * @description 根据榜单 key 拉取榜单数据，支持 time_window（时间窗口，默认 7d）和 limit（每页条数，默认 30 最大 100）。ranking_key 为必填查询参数
 * @params RankingQuery
 * @response 200:RankingResponse:榜单列表数据
 * @tag Rankings
 */
export async function GET(request: NextRequest) {
  const rankingKey = request.nextUrl.searchParams.get('ranking_key');
  if (!rankingKey) {
    return NextResponse.json({ error: 'ranking_key_required' }, { status: 400 });
  }

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
