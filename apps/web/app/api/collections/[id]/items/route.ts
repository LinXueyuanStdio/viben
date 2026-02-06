import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addItemToCollection, reorderCollectionItems } from '@/lib/services/collections';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const addItemSchema = z.object({
  itemId: z.string().uuid(),
  itemType: z.enum(['mcp', 'skill']),
  note: z.string().max(500).optional(),
});

const reorderSchema = z.object({
  itemIds: z.array(z.string()),
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
    const parsed = addItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await addItemToCollection(id, session.userId, parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, item: result.item }, { status: 201 });
  } catch (error) {
    console.error('Failed to add item to collection:', error);
    return NextResponse.json(
      { error: 'Failed to add item to collection' },
      { status: 500 }
    );
  }
}

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

    const success = await reorderCollectionItems(id, session.userId, parsed.data.itemIds);

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
