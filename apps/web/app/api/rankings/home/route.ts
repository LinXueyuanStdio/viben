import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getHomeConfig } from '@/lib/services/community';

function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed.offset === 'number' && Number.isFinite(parsed.offset) && parsed.offset >= 0) {
      return parsed.offset;
    }
  } catch {
    // invalid cursor, start from beginning
  }
  return 0;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

export async function GET(request: NextRequest) {
  const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 60) : 30;
  const cursor = request.nextUrl.searchParams.get('cursor');
  const offset = decodeCursor(cursor);

  const home = await getHomeConfig('web_home', request.nextUrl.searchParams.get('locale') ?? 'default');
  const firstSlot = home.slots[0] as { items?: unknown[] } | undefined;
  const allItems = firstSlot?.items ?? [];

  const pagedItems = allItems.slice(offset, offset + limit);
  const hasMore = offset + limit < allItems.length;
  const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

  return NextResponse.json({
    seed: request.nextUrl.searchParams.get('seed') ?? crypto.randomUUID(),
    feed_items: pagedItems,
    next_cursor: nextCursor,
    has_more: hasMore,
    sections: home.slots,
    generated_at: home.generated_at,
  });
}
