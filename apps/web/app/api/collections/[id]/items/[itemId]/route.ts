import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { removeItemFromCollection } from '@/lib/services/collections';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * 移除合集条目
 * @summary 移除合集条目
 * @description 从指定合集中删除一个条目，仅合集所有者可以操作。路径参数包含合集 ID 和条目 ID。成功后返回 `{ success: true }`。
 * @pathParams CollectionItemParams
 * @response 200:SuccessResponse:移除成功
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:合集不存在或无权操作
 * @responseSet auth
 * @auth bearer
 * @tag Collections
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, itemId } = await params;
    const success = await removeItemFromCollection(id, session.userId, itemId);

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove item from collection:', error);
    return NextResponse.json(
      { error: 'Failed to remove item from collection' },
      { status: 500 }
    );
  }
}
