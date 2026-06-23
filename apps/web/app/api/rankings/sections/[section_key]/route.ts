import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getHomeConfig } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ section_key: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { section_key: sectionKey } = await params;
  const home = await getHomeConfig('web_home', request.nextUrl.searchParams.get('locale') ?? 'default');
  const section = home.slots.find((slot) => {
    if (typeof slot !== 'object' || slot === null || !('slot_key' in slot)) return false;
    return (slot as { slot_key: unknown }).slot_key === sectionKey;
  }) as { slot_key: string; items?: unknown[] } | undefined;

  return NextResponse.json({
    section_key: sectionKey,
    cursor: request.nextUrl.searchParams.get('cursor'),
    seed: request.nextUrl.searchParams.get('seed'),
    category_id: request.nextUrl.searchParams.get('category_id'),
    time_window: request.nextUrl.searchParams.get('time_window') ?? '7d',
    items: section?.items ?? [],
    next_cursor: null,
    has_more: false,
  });
}
