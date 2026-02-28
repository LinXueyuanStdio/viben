import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, mcpPackages, users } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { listMcpQuerySchema, createMcpSchema } from '@/lib/validations/mcp';
import { generateId } from '@/lib/utils';
import { eq, desc, and, count } from 'drizzle-orm';
import { ZodError } from 'zod';

// GET - List MCP packages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = listMcpQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      category: searchParams.get('category'),
      sort: searchParams.get('sort'),
    });

    const { page, limit, category, sort } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(mcpPackages.isPublished, true)];
    if (category) {
      conditions.push(eq(mcpPackages.category, category));
    }

    // Build order by
    const orderBy =
      sort === 'popular'
        ? desc(mcpPackages.favoritesCount)
        : sort === 'downloads'
          ? desc(mcpPackages.downloadsCount)
          : desc(mcpPackages.createdAt);

    // Query packages with author info
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
        favoritesCount: mcpPackages.favoritesCount,
        downloadsCount: mcpPackages.downloadsCount,
        ratingAvg: mcpPackages.ratingAvg,
        createdAt: mcpPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(mcpPackages)
      .innerJoin(users, eq(mcpPackages.authorId, users.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(mcpPackages)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    return NextResponse.json({
      data: packages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create MCP package
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
    const data = createMcpSchema.parse(body);

    // Check if slug is unique
    const existing = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.slug, data.slug),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Package slug already exists' },
        { status: 400 }
      );
    }

    const packageId = generateId();

    await db.insert(mcpPackages).values({
      id: packageId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      longDescription: data.longDescription || null,
      transport: data.transport,
      entryPoint: data.entryPoint,
      repositoryUrl: data.repositoryUrl || null,
      homepageUrl: data.homepageUrl || null,
      license: data.license,
      tags: data.tags,
      category: data.category,
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
    console.error('Create MCP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
