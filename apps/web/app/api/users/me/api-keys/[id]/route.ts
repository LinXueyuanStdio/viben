import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { eq, and } from 'drizzle-orm';

/**
 * 撤销 API Key
 * @description 删除指定 ID 的 API Key。仅 Key 所有者可操作，验证通过用户 ID 和 Key ID 的双重匹配。删除后该 Key 立即失效，无法恢复。需登录后调用。
 * @pathParams ApiKeyIdParams
 * @response 200:SuccessResponse:撤消成功
 * @response 404:ErrorResponse:API Key 不存在或不属于当前用户
 * @response 500:ErrorResponse:服务器内部错误
 * @responseSet auth
 * @response 401:ErrorResponse:未登录或 token 无效
 * @auth bearer
 * @tag ApiKeys
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    // Find the key and verify ownership
    const key = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, id), eq(apiKeys.userId, session.userId)),
    });

    if (!key) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Delete API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
