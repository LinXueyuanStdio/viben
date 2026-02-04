import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { forkCollection } from '@/lib/services/collections';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
    const forked = await forkCollection(id, session.userId);

    if (!forked) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection: forked }, { status: 201 });
  } catch (error) {
    console.error('Failed to fork collection:', error);
    return NextResponse.json(
      { error: 'Failed to fork collection' },
      { status: 500 }
    );
  }
}
