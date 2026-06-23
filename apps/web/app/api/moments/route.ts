import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { createMoment } from '@/lib/services/community';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const visibility =
      body.visibility === 'unlisted' || body.visibility === 'private'
        ? body.visibility
        : 'public';
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((topic: unknown): topic is string => typeof topic === 'string')
      : [];

    return NextResponse.json({
      moment: await createMoment({
        session,
        body: typeof body.body === 'string' ? body.body : null,
        visibility,
        topics,
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
