import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { toggleBookmark, isBookmarked } from '@/lib/services/social';

/** @ignore */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await toggleBookmark(session.userId, 'mcp', id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to toggle bookmark' },
      { status: 500 }
    );
  }
}

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ isBookmarked: false });
    }

    const { id } = await params;
    const bookmarked = await isBookmarked(session.userId, 'mcp', id);

    return NextResponse.json({ isBookmarked: bookmarked });
  } catch (error) {
    console.error('Failed to get bookmark status:', error);
    return NextResponse.json(
      { error: 'Failed to get bookmark status' },
      { status: 500 }
    );
  }
}
