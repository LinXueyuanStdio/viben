import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reorderCollectionItemsByPosition } from '@/lib/services/collections';
import { ReorderByPositionBody } from '@/lib/validations/collections';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 按位置重新排序合集条目
 * @summary 按位置重新排序合集条目
 * @description 通过指定每个条目的新位置（itemId 与 position 的映射）来重新排列合集条目，仅合集所有者可操作。position 从 0 开始计数。成功后返回 `{ success: true }`。
 * @pathParams CollectionsParams
 * @body ReorderByPositionBody
 * @response 200:SuccessResponse:排序成功
 * @response 400:ErrorResponse:请求参数无效
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:合集不存在或无权操作
 * @responseSet auth
 * @auth bearer
 * @tag Collections
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = ReorderByPositionBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await reorderCollectionItemsByPosition(
      id,
      session.userId,
      parsed.data.items
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder collection items:', error);
    return NextResponse.json(
      { error: 'Failed to reorder collection items' },
      { status: 500 }
    );
  }
}
