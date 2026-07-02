import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reorderCollectionItemsByPosition } from '@/lib/services/collections';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const reorderSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      position: z.number().int().min(0),
    })
  ),
});

export async function PATCH(
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
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await reorderCollectionItemsByPosition(
      id,
      session.userId,
      parsed.data.items
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder collection items:', error);
    return NextResponse.json(
      { error: 'Failed to reorder collection items' },
      { status: 500 }
    );
  }
}
