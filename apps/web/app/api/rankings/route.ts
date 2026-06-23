import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listRanking } from '@/lib/services/community';

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
