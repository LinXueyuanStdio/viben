import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listPublicCollections, listUserCollections, createCollection } from '@/lib/services/collections';
import { z } from 'zod';

const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  entityType: z.enum(['mcp', 'skill']),
  isPublic: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const entityType = request.nextUrl.searchParams.get('type') as 'mcp' | 'skill' | null;
    const mine = request.nextUrl.searchParams.get('mine') === 'true';

    if (mine) {
      if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const collections = await listUserCollections(session.userId);
      return NextResponse.json({ collections });
    }

    const collections = await listPublicCollections(entityType || undefined);
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Failed to list collections:', error);
    return NextResponse.json(
      { error: 'Failed to list collections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCollectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const collection = await createCollection(session.userId, parsed.data);

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    console.error('Failed to create collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}
