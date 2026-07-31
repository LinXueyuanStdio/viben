import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, bookmarks, mcpPackages, skillPackages } from '@/lib/db';
import { eq, and, lt, inArray, desc } from 'drizzle-orm';

interface FavoritePackage {
  id: string;
  type: 'mcp' | 'skill';
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category: string | null;
  bookmarksCount: number;
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

interface FavoritesResponse {
  favorites: FavoritePackage[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * 获取我的收藏列表
 * @description 获取当前用户收藏的 MCP 和 Skill 包列表，按收藏时间降序排列，支持基于 createdAt 的游标分页。limit 默认 20、最大 50。返回 favorites 数组（每项含包详情及作者信息），以及 nextCursor 和 hasMore 分页信息。需登录后调用。
 * @params FavoritesQuery
 * @response 200:UserFavoritesResponse:收藏列表，含 favorites、nextCursor、hasMore 分页信息
 * @response 500:ErrorResponse:查询失败
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Users
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse pagination params
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
    const cursor = request.nextUrl.searchParams.get('cursor');

    // Build where clause for cursor-based pagination
    const whereClause = cursor
      ? and(
          eq(bookmarks.userId, session.userId),
          lt(bookmarks.createdAt, new Date(cursor))
        )
      : eq(bookmarks.userId, session.userId);

    // Fetch one extra to determine if there are more results
    const userFavorites = await db.query.bookmarks.findMany({
      where: whereClause,
      orderBy: (fav, { desc }) => [desc(fav.createdAt)],
      limit: limit + 1,
    });

    const hasMore = userFavorites.length > limit;
    const items = hasMore ? userFavorites.slice(0, limit) : userFavorites;

    if (items.length === 0) {
      return NextResponse.json<FavoritesResponse>({
        favorites: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    // Separate MCP and skill IDs
    const mcpIds = items
      .filter((f) => f.entityType === 'mcp')
      .map((f) => f.entityId);
    const skillIds = items
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

    for (const fav of items) {
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
            bookmarksCount: pkg.bookmarksCount,
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
            bookmarksCount: pkg.bookmarksCount,
            downloadsCount: pkg.downloadsCount,
            ratingAvg: pkg.ratingAvg,
            skillType: pkg.skillType,
            author: pkg.author,
            favoritedAt: fav.createdAt,
          });
        }
      }
    }

    // Next cursor is the createdAt of the last item
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore ? lastItem.createdAt.toISOString() : null;

    return NextResponse.json<FavoritesResponse>({
      favorites: result,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('Failed to fetch favorites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}
