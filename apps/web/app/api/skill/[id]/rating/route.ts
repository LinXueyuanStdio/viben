import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRating, setRating } from '@/lib/services/social';
import { z } from 'zod';

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
});

/** @ignore */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;
    const rating = await getRating(session?.userId ?? null, 'skill', id);

    return NextResponse.json(rating);
  } catch (error) {
    console.error('Failed to get rating:', error);
    return NextResponse.json(
      { error: 'Failed to get rating' },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();
    const parsed = ratingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const rating = await setRating(session.userId, 'skill', id, parsed.data.score);

    return NextResponse.json(rating);
  } catch (error) {
    console.error('Failed to set rating:', error);
    return NextResponse.json(
      { error: 'Failed to set rating' },
      { status: 500 }
    );
  }
}
