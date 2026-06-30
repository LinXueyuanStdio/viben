import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, favorites, mcpPackages, skillPackages } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';

interface FavoritePackage {
  id: string;
  type: 'mcp' | 'skill';
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  transport?: string;
  skillType?: string;
  author: {
    username: string;
    userSlug: string;
    avatarUrl: string | null;
  } | null;
  favoritedAt: Date;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's favorites
    const userFavorites = await db.query.favorites.findMany({
      where: eq(favorites.userId, session.userId),
      orderBy: (fav, { desc }) => [desc(fav.createdAt)],
    });

    if (userFavorites.length === 0) {
      return NextResponse.json({ favorites: [] });
    }

    // Separate MCP and skill IDs
    const mcpIds = userFavorites
      .filter((f) => f.entityType === 'mcp')
      .map((f) => f.entityId);
    const skillIds = userFavorites
      .filter((f) => f.entityType === 'skill')
      .map((f) => f.entityId);

    // Fetch MCP packages
    const mcps = mcpIds.length > 0
      ? await db.query.mcpPackages.findMany({
          where: inArray(mcpPackages.id, mcpIds),
          with: {
            author: {
              columns: {
                username: true,
                userSlug: true,
                avatarUrl: true,
              },
            },
          },
        })
      : [];

    // Fetch skill packages
    const skills = skillIds.length > 0
      ? await db.query.skillPackages.findMany({
          where: inArray(skillPackages.id, skillIds),
          with: {
            author: {
              columns: {
                username: true,
                userSlug: true,
                avatarUrl: true,
              },
            },
          },
        })
      : [];

    // Create lookup maps for quick access
    const mcpMap = new Map(mcps.map((m) => [m.id, m]));
    const skillMap = new Map(skills.map((s) => [s.id, s]));

    // Build result maintaining favorites order
    const result: FavoritePackage[] = [];

    for (const fav of userFavorites) {
      if (fav.entityType === 'mcp') {
        const pkg = mcpMap.get(fav.entityId);
        if (pkg) {
          result.push({
            id: pkg.id,
            type: 'mcp',
            name: pkg.name,
            slug: pkg.slug,
            version: pkg.version,
            description: pkg.description,
            category: pkg.category,
            favoritesCount: pkg.favoritesCount,
            downloadsCount: pkg.downloadsCount,
            ratingAvg: pkg.ratingAvg,
            transport: pkg.transport,
            author: pkg.author,
            favoritedAt: fav.createdAt,
          });
        }
      } else if (fav.entityType === 'skill') {
        const pkg = skillMap.get(fav.entityId);
        if (pkg) {
          result.push({
            id: pkg.id,
            type: 'skill',
            name: pkg.name,
            slug: pkg.slug,
            version: pkg.version,
            description: pkg.description,
            category: pkg.category,
            favoritesCount: pkg.favoritesCount,
            downloadsCount: pkg.downloadsCount,
            ratingAvg: pkg.ratingAvg,
            skillType: pkg.skillType,
            author: pkg.author,
            favoritedAt: fav.createdAt,
          });
        }
      }
    }

    return NextResponse.json({ favorites: result });
  } catch (error) {
    console.error('Failed to fetch favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}
