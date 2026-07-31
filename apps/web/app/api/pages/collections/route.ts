import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, publishedPages } from '@/lib/db';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { slugify } from '@/lib/utils';

interface ChaptersJson {
  collection_slug?: string;
  collection_name?: string;
  chapters?: Array<{ number: number; title: string; page_slug?: string }>;
}

function isChaptersJson(value: unknown): value is ChaptersJson {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    (!obj.collection_slug || typeof obj.collection_slug === 'string') &&
    (!obj.collection_name || typeof obj.collection_name === 'string') &&
    (!obj.chapters || Array.isArray(obj.chapters))
  );
}

/**
 * 获取页面合集列表
 * @summary 获取页面合集列表
 * @description 查询公开合集列表（从已发布页面的 chaptersJson 中提取去重）。传 mine=true 时返回当前用户创建的合集，需登录（未登录时 mine=true 返回 401）
 * @params PageCollectionsQuery
 * @response 200:PageCollectionsListResponse:页面合集列表
 * @response 401:ErrorResponse:未登录（mine=true 时）
 * @tag Pages
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const mine = request.nextUrl.searchParams.get('mine') === 'true';

    if (mine) {
      if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Find all user's pages that have chaptersJson set
      const pages = await db
        .select({
          chaptersJson: publishedPages.chaptersJson,
        })
        .from(publishedPages)
        .where(
          and(
            eq(publishedPages.userId, session.userId),
            isNotNull(publishedPages.chaptersJson)
          )
        );

      // Extract unique collections
      const collectionMap = new Map<string, { slug: string; name: string; page_count: number }>();
      for (const page of pages) {
        const data = page.chaptersJson;
        if (!isChaptersJson(data)) continue;
        const slug = data.collection_slug;
        const name = data.collection_name;
        if (!slug || !name) continue;
        const existing = collectionMap.get(slug);
        if (existing) {
          existing.page_count++;
        } else {
          collectionMap.set(slug, { slug, name, page_count: 1 });
        }
      }

      return NextResponse.json({
        collections: Array.from(collectionMap.values()),
      });
    }

    // Public: list public collections (any user)
    const pages = await db
      .select({
        chaptersJson: publishedPages.chaptersJson,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.visibility, 'public'),
          isNotNull(publishedPages.chaptersJson)
        )
      );

    const collectionMap = new Map<string, { slug: string; name: string; page_count: number }>();
    for (const page of pages) {
      const data = page.chaptersJson;
      if (!isChaptersJson(data)) continue;
      const slug = data.collection_slug;
      const name = data.collection_name;
      if (!slug || !name) continue;
      const existing = collectionMap.get(slug);
      if (existing) {
        existing.page_count++;
      } else {
        collectionMap.set(slug, { slug, name, page_count: 1 });
      }
    }

    return NextResponse.json({
      collections: Array.from(collectionMap.values()),
    });
  } catch (error) {
    console.error('Failed to list page collections:', error);
    return NextResponse.json(
      { error: 'Failed to list page collections' },
      { status: 500 }
    );
  }
}

/**
 * 创建页面合集
 * @summary 验证并生成合集 slug
 * @description 验证合集名称并生成 slug，不写入数据库，仅返回计算后的合集信息（含 slug 和 name）。需登录，名称不超过 100 字符
 * @body CreatePageCollectionBody
 * @response 200:PageCollectionResponse:合集信息（含 slug 和 name）
 * @response 400:ErrorResponse:名称无效或过长
 * @responseSet auth
 * @tag Pages
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: 'Collection name is required (max 100 chars)' },
        { status: 400 }
      );
    }

    const slug = slugify(name);

    return NextResponse.json({
      collection: { slug, name },
    });
  } catch (error) {
    console.error('Failed to create page collection:', error);
    return NextResponse.json(
      { error: 'Failed to create page collection' },
      { status: 500 }
    );
  }
}
