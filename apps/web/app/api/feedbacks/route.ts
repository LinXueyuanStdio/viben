import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { feedbacks } from '@/lib/db/schema';

const VALID_CATEGORIES = ['bug', 'suggestion', 'other'] as const;

/**
 * 提交反馈
 * @summary 提交页面反馈
 * @description 对页面提交反馈，需登录。包含 page_id（页面 ID）、category（分类：bug/suggestion/other）、rating（评分 1-5）、content（内容，最多 1000 字）。成功返回包含反馈 ID 的响应
 * @body FeedbackBody
 * @response 200:FeedbackResponse:反馈结果（含创建 id）
 * @response 400:ErrorResponse:参数缺失或无效
 * @responseSet auth
 * @auth bearer
 * @tag Feedbacks
 */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { page_id, category, rating, content } = body;

    if (!page_id) {
      return NextResponse.json({ error: 'missing_page_id' }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
    }

    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'missing_content' }, { status: 400 });
    }

    const [fb] = await db
      .insert(feedbacks)
      .values({
        pageId: page_id,
        reporterId: session.userId,
        category,
        rating: Math.round(rating),
        content: content.slice(0, 1000),
      })
      .returning({ id: feedbacks.id });

    return NextResponse.json({ id: fb.id });
  } catch (error) {
    console.error('Feedback creation failed:', error);
    return NextResponse.json({ error: 'feedback_failed' }, { status: 500 });
  }
}
