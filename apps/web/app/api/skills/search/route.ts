import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, skillPackages, users } from '@/lib/db';
import { searchSkillQuerySchema } from '@/lib/validations/skill';
import { eq, desc, or, ilike, and, count } from 'drizzle-orm';

// GET - Search Skill packages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchSkillQuerySchema.parse({
      q: searchParams.get('q'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const { q, page, limit } = query;
    const offset = (page - 1) * limit;
    const searchTerm = `%${q}%`;

    // Search in name, description, and slug
    const searchCondition = and(
      eq(skillPackages.isPublished, true),
      or(
        ilike(skillPackages.name, searchTerm),
        ilike(skillPackages.description, searchTerm),
        ilike(skillPackages.slug, searchTerm)
      )
    );

    // Query packages
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
      .where(searchCondition)
      .orderBy(desc(skillPackages.downloadsCount))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(skillPackages)
      .where(searchCondition);

    const total = totalResult?.count ?? 0;

    return NextResponse.json({
      packages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      query: q,
    });
  } catch (error) {
    console.error('Search Skills error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
