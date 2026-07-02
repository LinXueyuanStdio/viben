import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { moveItemsToCollection } from '@/lib/services/collections';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const moveSchema = z.object({
  itemIds: z.array(z.string()),
  targetCollectionId: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = moveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await moveItemsToCollection(
      id,
      session.userId,
      parsed.data.itemIds,
      parsed.data.targetCollectionId
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to move collection items:', error);
    return NextResponse.json(
      { error: 'Failed to move collection items' },
      { status: 500 }
    );
  }
}
