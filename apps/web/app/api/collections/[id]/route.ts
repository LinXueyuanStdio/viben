import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCollection, updateCollection, deleteCollection, listCollectionItems } from '@/lib/services/collections';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    const { id } = await params;

    const collection = await getCollection(id, session?.userId);

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const items = await listCollectionItems(id, session?.userId);

    return NextResponse.json({ collection, items });
  } catch (error) {
    console.error('Failed to get collection:', error);
    return NextResponse.json(
      { error: 'Failed to get collection' },
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
    const parsed = updateCollectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const collection = await updateCollection(id, session.userId, parsed.data);

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection });
  } catch (error) {
    console.error('Failed to update collection:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
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

    const { id } = await params;
    const deleted = await deleteCollection(id, session.userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete collection:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
