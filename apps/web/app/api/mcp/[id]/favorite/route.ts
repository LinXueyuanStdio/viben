import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { toggleFavorite, isFavorited } from '@/lib/services/social';

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
    const result = await toggleFavorite(session.userId, 'mcp', id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ isFavorited: false });
    }

    const { id } = await params;
    const favorited = await isFavorited(session.userId, 'mcp', id);

    return NextResponse.json({ isFavorited: favorited });
  } catch (error) {
    console.error('Failed to get favorite status:', error);
    return NextResponse.json(
      { error: 'Failed to get favorite status' },
      { status: 500 }
    );
  }
}
