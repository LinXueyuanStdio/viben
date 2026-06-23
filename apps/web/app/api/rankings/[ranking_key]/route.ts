import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listRanking } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ ranking_key: string }>;
}

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
