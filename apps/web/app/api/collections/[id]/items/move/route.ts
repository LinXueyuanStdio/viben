import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { moveItemsToCollection } from '@/lib/services/collections';
import { MoveCollectionItemBody } from '@/lib/validations/collections';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 移动合集条目到另一合集
 * @summary 移动合集条目
 * @description 将当前合集中的条目批量移动到另一个合集，仅当前合集所有者可操作。请求体包含 itemIds（要移动的条目 ID 数组）和 targetCollectionId（目标合集 ID）。成功后返回 `{ success: true }`。
 * @pathParams CollectionsParams
 * @body MoveCollectionItemBody
 * @response 200:SuccessResponse:移动成功
 * @response 400:ErrorResponse:请求参数无效
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:合集不存在或无权操作
 * @responseSet auth
 * @auth bearer
 * @tag Collections
 */
export async function POST(
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
    const parsed = MoveCollectionItemBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await moveItemsToCollection(
      id,
      session.userId,
      parsed.data.itemIds,
      parsed.data.targetCollectionId
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to move collection items:', error);
    return NextResponse.json(
      { error: 'Failed to move collection items' },
      { status: 500 }
    );
  }
}
