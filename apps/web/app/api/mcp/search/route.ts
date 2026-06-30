import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, mcpPackages, users } from '@/lib/db';
import { searchMcpQuerySchema } from '@/lib/validations/mcp';
import { eq, desc, or, ilike, and, count } from 'drizzle-orm';

// GET - Search MCP packages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchMcpQuerySchema.parse({
      q: searchParams.get('q'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const { q, page, limit } = query;
    const offset = (page - 1) * limit;
    const searchTerm = `%${q}%`;

    // Search in name, description, and tags
    const searchCondition = and(
      eq(mcpPackages.isPublished, true),
      or(
        ilike(mcpPackages.name, searchTerm),
        ilike(mcpPackages.description, searchTerm),
        ilike(mcpPackages.slug, searchTerm)
      )
    );

    // Query packages
    const packages = await db
      .select({
        id: mcpPackages.id,
        name: mcpPackages.name,
        slug: mcpPackages.slug,
        version: mcpPackages.version,
        description: mcpPackages.description,
        transport: mcpPackages.transport,
        tags: mcpPackages.tags,
        category: mcpPackages.category,
        favoritesCount: mcpPackages.bookmarksCount,
        downloadsCount: mcpPackages.downloadsCount,
        ratingAvg: mcpPackages.ratingAvg,
        createdAt: mcpPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          userSlug: users.userSlug,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(mcpPackages)
      .innerJoin(users, eq(mcpPackages.authorId, users.id))
      .where(searchCondition)
      .orderBy(desc(mcpPackages.downloadsCount))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(mcpPackages)
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
    console.error('Search MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
