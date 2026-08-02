import { NextRequest, NextResponse } from 'next/server';
import { searchPublishedPagesByAuthor } from '@/lib/services/community';

/**
 * 搜索用户已发布页面
 * @summary 按作者 slug 和 pageuid 搜索页面
 * @params author_slug (必填), q (可选, 搜索 pageuid)
 * @response 200: { pages: Array<{uid, title, authorSlug}> }
 * @tag Pages
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const authorSlug = sp.get('author_slug');
    const query = sp.get('q') || undefined;

    if (!authorSlug) {
      return NextResponse.json({ error: 'author_slug is required' }, { status: 400 });
    }

    const pages = await searchPublishedPagesByAuthor(authorSlug, { query });
    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Failed to search pages:', error);
    return NextResponse.json({ error: 'Failed to search pages' }, { status: 500 });
  }
}
