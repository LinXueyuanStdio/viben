import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getOptionalSession } from '@/lib/auth/middleware';
import { getCommunitySummary } from '@/lib/services/community';

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
