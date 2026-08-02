import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, publishedPages, mcpPackages, skillPackages, users } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

/**
 * 获取当前用户可置顶的项目
 * @description 返回用户自己的公开页面、已发布 MCP 包和技能包，供置顶选择。需登录。
 * @params PinnableItemsQuery
 * @response 200:PinnableItemsResponse:按类型分组的可置顶项目
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @tag Profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const typesParam = searchParams.get('types');
    const types = typesParam ? typesParam.split(',') : ['page', 'mcp', 'skill'];
    const q = searchParams.get('q')?.toLowerCase();

    const result: { pages: unknown[]; mcps: unknown[]; skills: unknown[] } = {
      pages: [],
      mcps: [],
      skills: [],
    };

    if (types.includes('page')) {
      const conditions = [
        eq(publishedPages.userId, session.userId),
        eq(publishedPages.moderationStatus, 'approved'),
        eq(publishedPages.visibility, 'public'),
      ];
      const pages = await db
        .select({
          id: publishedPages.id,
          uid: publishedPages.uid,
          title: publishedPages.title,
          description: publishedPages.description,
          coverUrl: publishedPages.coverUrl,
          likeCount: publishedPages.likeCount,
          viewCount: publishedPages.viewCount,
          visibility: publishedPages.visibility,
        })
        .from(publishedPages)
        .where(and(...conditions))
        .orderBy(publishedPages.lastPublishedAt)
        .limit(100);

      result.pages = q
        ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
        : pages;
    }

    if (types.includes('mcp')) {
      const mcps = await db
        .select({
          id: mcpPackages.id,
          name: mcpPackages.name,
          slug: mcpPackages.slug,
          description: mcpPackages.description,
          version: mcpPackages.version,
          transport: mcpPackages.transport,
          downloadsCount: mcpPackages.downloadsCount,
          bookmarksCount: mcpPackages.bookmarksCount,
        })
        .from(mcpPackages)
        .where(and(
          eq(mcpPackages.authorId, session.userId),
          eq(mcpPackages.isPublished, true)
        ))
        .orderBy(mcpPackages.createdAt)
        .limit(100);

      result.mcps = q
        ? mcps.filter((m) => m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q))
        : mcps;
    }

    if (types.includes('skill')) {
      const skills = await db
        .select({
          id: skillPackages.id,
          name: skillPackages.name,
          slug: skillPackages.slug,
          description: skillPackages.description,
          version: skillPackages.version,
          skillType: skillPackages.skillType,
          downloadsCount: skillPackages.downloadsCount,
          bookmarksCount: skillPackages.bookmarksCount,
        })
        .from(skillPackages)
        .where(and(
          eq(skillPackages.authorId, session.userId),
          eq(skillPackages.isPublished, true)
        ))
        .orderBy(skillPackages.createdAt)
        .limit(100);

      result.skills = q
        ? skills.filter((s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
        : skills;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get pinnable items error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
