import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getHomeConfig } from '@/lib/services/community';

export async function GET(request: NextRequest) {
  const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 60) : 30;
  const home = await getHomeConfig('web_home', request.nextUrl.searchParams.get('locale') ?? 'default');
  const firstSlot = home.slots[0] as { items?: unknown[] } | undefined;

  return NextResponse.json({
    seed: request.nextUrl.searchParams.get('seed') ?? crypto.randomUUID(),
    feed_items: (firstSlot?.items ?? []).slice(0, limit),
    next_cursor: null,
    has_more: false,
    sections: home.slots,
    generated_at: home.generated_at,
  });
}
