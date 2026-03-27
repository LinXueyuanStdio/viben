import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, skillPackages, users } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { listSkillQuerySchema, createSkillSchema } from '@/lib/validations/skill';
import { generateId } from '@/lib/utils';
import { eq, desc, and, count } from 'drizzle-orm';
import { ZodError } from 'zod';

// GET - List Skill packages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = listSkillQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      category: searchParams.get('category'),
      type: searchParams.get('type'),
      sort: searchParams.get('sort'),
    });

    const { page, limit, category, type, sort } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(skillPackages.isPublished, true)];
    if (category) {
      conditions.push(eq(skillPackages.category, category));
    }
    if (type) {
      conditions.push(eq(skillPackages.skillType, type));
    }

    // Build order by
    const orderBy =
      sort === 'popular'
        ? desc(skillPackages.favoritesCount)
        : sort === 'downloads'
          ? desc(skillPackages.downloadsCount)
          : desc(skillPackages.createdAt);

    // Query packages with author info
    const packages = await db
      .select({
        id: skillPackages.id,
        name: skillPackages.name,
        slug: skillPackages.slug,
        version: skillPackages.version,
        description: skillPackages.description,
        skillType: skillPackages.skillType,
        tags: skillPackages.tags,
        category: skillPackages.category,
        compatibility: skillPackages.compatibility,
        favoritesCount: skillPackages.favoritesCount,
        downloadsCount: skillPackages.downloadsCount,
        ratingAvg: skillPackages.ratingAvg,
        createdAt: skillPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(skillPackages)
      .innerJoin(users, eq(skillPackages.authorId, users.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(skillPackages)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    return NextResponse.json({
      packages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List Skills error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create Skill package
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    // Check if user is a developer
    if (session.role === 'user') {
      return NextResponse.json(
        { error: 'Only developers can publish packages' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createSkillSchema.parse(body);

    // Check if slug is unique
    const existing = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.slug, data.slug),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Package slug already exists' },
        { status: 400 }
      );
    }

    const packageId = generateId();

    await db.insert(skillPackages).values({
      id: packageId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      longDescription: data.longDescription || null,
      skillType: data.skillType,
      triggerPatterns: data.triggerPatterns,
      content: data.content,
      tags: data.tags,
      category: data.category,
      compatibility: data.compatibility,
      configSchema: data.configSchema || null,
      dependencies: data.dependencies,
      authorId: session.userId,
      isPublished: false, // Start as draft
    });

    return NextResponse.json({ success: true, id: packageId });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create Skill error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
