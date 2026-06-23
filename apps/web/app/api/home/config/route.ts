import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getHomeConfig } from '@/lib/services/community';

export async function GET(request: NextRequest) {
  const surface = request.nextUrl.searchParams.get('surface') ?? 'web_home';
  const locale = request.nextUrl.searchParams.get('locale') ?? 'default';

  if (surface !== 'web_home') {
    return NextResponse.json({ error: 'unsupported_surface' }, { status: 400 });
  }

  return NextResponse.json(await getHomeConfig(surface, locale));
}
