import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { removeItemFromCollection } from '@/lib/services/collections';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;
    const success = await removeItemFromCollection(id, session.userId, itemId);

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove item from collection:', error);
    return NextResponse.json(
      { error: 'Failed to remove item from collection' },
      { status: 500 }
    );
  }
}
