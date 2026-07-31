import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, publishedPages } from '@/lib/db';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';

const pinSchema = z.object({
  pinned: z.boolean(),
});

/**
 * 置顶/取消置顶已发布页面
 * @summary 切换页面置顶状态
 * @description 切换页面的置顶状态，需登录且仅页面所有者可操作。每个用户最多置顶 6 个页面，超过上限返回 400。非所有者返回 403，页面不存在返回 404。成功返回 { success: true, pinned: boolean }
 * @pathParams PagesParams
 * @body PinPageBody
 * @response 200:PinPageResponse:操作成功，返回当前置顶状态
 * @response 400:ErrorResponse:请求无效或超过置顶上限
 * @response 401:ErrorResponse:未登录
 * @response 403:ErrorResponse:无权操作他人页面
 * @response 404:ErrorResponse:页面不存在
 * @responseSet auth
 * @tag Pages
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { pinned } = pinSchema.parse(body);

    // Check page ownership
    const [page] = await db
      .select({ id: publishedPages.id, userId: publishedPages.userId })
      .from(publishedPages)
      .where(eq(publishedPages.id, id));

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (page.userId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (pinned) {
      // Check pin limit (max 6)
      const [result] = await db
        .select({ count: count() })
        .from(publishedPages)
        .where(
          and(
            eq(publishedPages.userId, session.userId),
            eq(publishedPages.isPinned, true)
          )
        );

      if ((result?.count ?? 0) >= 6) {
        return NextResponse.json(
          { error: 'Maximum 6 pinned pages allowed' },
          { status: 400 }
        );
      }

      await db
        .update(publishedPages)
        .set({ isPinned: true, pinnedAt: new Date() })
        .where(eq(publishedPages.id, id));
    } else {
      await db
        .update(publishedPages)
        .set({ isPinned: false, pinnedAt: null })
        .where(eq(publishedPages.id, id));
    }

    return NextResponse.json({ success: true, pinned });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Pin page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
