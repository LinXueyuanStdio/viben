import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listPublicCollections,
  listUserCollections,
  createCollection,
} from '@/lib/services/collections';
import { z } from 'zod';

const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only')
    .optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const mine = request.nextUrl.searchParams.get('mine') === 'true';

    if (mine) {
      if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const collections = await listUserCollections(session.userId);
      return NextResponse.json({ collections });
    }

    const collections = await listPublicCollections();
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
    if (error instanceof Error && error.message === 'Collection slug already exists') {
      return NextResponse.json(
        { error: 'Collection slug already exists' },
        { status: 409 }
      );
    }
    console.error('Failed to create collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}
