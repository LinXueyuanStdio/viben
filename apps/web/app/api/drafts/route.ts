import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, drafts } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { listDraftsQuerySchema, createDraftSchema } from '@/lib/validations/draft';
import { generateId } from '@/lib/utils';
import { eq, and, desc, count, gt } from 'drizzle-orm';
import { ZodError } from 'zod';

// Draft expiry duration: 30 days in milliseconds
const DRAFT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// GET - List user's drafts
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = listDraftsQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      packageType: searchParams.get('packageType'),
      includeExpired: searchParams.get('includeExpired'),
    });

    const { page, limit, packageType, includeExpired } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(drafts.userId, session.userId)];

    if (packageType) {
      conditions.push(eq(drafts.packageType, packageType));
    }

    if (!includeExpired) {
      conditions.push(gt(drafts.expiresAt, new Date()));
    }

    // Query drafts
    const userDrafts = await db
      .select({
        id: drafts.id,
        packageType: drafts.packageType,
        data: drafts.data,
        createdAt: drafts.createdAt,
        updatedAt: drafts.updatedAt,
        expiresAt: drafts.expiresAt,
      })
      .from(drafts)
      .where(and(...conditions))
      .orderBy(desc(drafts.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(drafts)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    // Add isExpired flag to each draft
    const draftsWithExpiry = userDrafts.map((draft) => ({
      ...draft,
      isExpired: new Date(draft.expiresAt) < new Date(),
    }));

    return NextResponse.json({
      drafts: draftsWithExpiry,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List drafts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new draft
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createDraftSchema.parse(body);

    const draftId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DRAFT_EXPIRY_MS);

    await db.insert(drafts).values({
      id: draftId,
      userId: session.userId,
      packageType: data.packageType,
      data: data.data,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });

    return NextResponse.json(
      {
        draft: {
          id: draftId,
          packageType: data.packageType,
          data: data.data,
          createdAt: now,
          updatedAt: now,
          expiresAt,
          isExpired: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create draft error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
