import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, drafts } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { updateDraftSchema } from '@/lib/validations/draft';
import { eq, and } from 'drizzle-orm';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get draft by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const draft = await db.query.drafts.findFirst({
      where: and(
        eq(drafts.id, id),
        eq(drafts.userId, session.userId)
      ),
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({
      draft: {
        ...draft,
        isExpired: new Date(draft.expiresAt) < new Date(),
      },
    });
  } catch (error) {
    console.error('Get draft error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update draft (auto-save)
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
    const updateData = updateDraftSchema.parse(body);

    // Get current draft to verify ownership
    const existingDraft = await db.query.drafts.findFirst({
      where: and(
        eq(drafts.id, id),
        eq(drafts.userId, session.userId)
      ),
    });

    if (!existingDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Merge existing data with new data (partial update)
    const mergedData = {
      ...(existingDraft.data as Record<string, unknown>),
      ...updateData.data,
    };

    const [updatedDraft] = await db
      .update(drafts)
      .set({
        data: mergedData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(drafts.id, id),
        eq(drafts.userId, session.userId)
      ))
      .returning();

    if (!updatedDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({
      draft: {
        ...updatedDraft,
        isExpired: new Date(updatedDraft.expiresAt) < new Date(),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update draft error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete draft
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

    const [deletedDraft] = await db
      .delete(drafts)
      .where(and(
        eq(drafts.id, id),
        eq(drafts.userId, session.userId)
      ))
      .returning({ id: drafts.id });

    if (!deletedDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
