import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addItemToCollection, reorderCollectionItems, batchRemoveItemsFromCollection } from '@/lib/services/collections';
import { AddCollectionItemBody, BatchDeleteCollectionItemBody, ReorderCollectionItemBody } from '@/lib/validations/collections';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 添加合集条目
 * @summary 添加合集条目
 * @description 向指定合集中添加一个包（MCP 或 Skill），仅合集所有者可操作。请求体通过 Zod 验证 itemId（UUID 格式）和 itemType（mcp 或 skill）。成功后返回 `{ success: true, item }`，状态码 201。
 * @pathParams CollectionsParams
 * @body AddCollectionItemBody
 * @response 201:AddCollectionItemResponse:添加成功
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
    const parsed = AddCollectionItemBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await addItemToCollection(id, session.userId, parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, item: result.item }, { status: 201 });
  } catch (error) {
    console.error('Failed to add item to collection:', error);
    return NextResponse.json(
      { error: 'Failed to add item to collection' },
      { status: 500 }
    );
  }
}

/**
 * 重新排序合集条目
 * @summary 重新排序合集条目
 * @description 通过指定条目 ID 列表的顺序来重新排列合集条目，仅合集所有者可操作。请求体为 itemIds 数组，数组中的顺序即为新顺序。成功后返回 `{ success: true }`。
 * @pathParams CollectionsParams
 * @body ReorderCollectionItemBody
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
    const parsed = ReorderCollectionItemBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await reorderCollectionItems(id, session.userId, parsed.data.itemIds);

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

/**
 * 批量删除合集条目
 * @summary 批量删除合集条目
 * @description 从指定合集中批量删除多条条目，仅合集所有者可操作。请求体为 itemIds 字符串数组。成功后返回 `{ success: true }`。
 * @pathParams CollectionsParams
 * @body BatchDeleteCollectionItemBody
 * @response 200:SuccessResponse:删除成功
 * @response 400:ErrorResponse:请求参数无效
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

    const { id } = await params;
    const body = await request.json();
    const parsed = BatchDeleteCollectionItemBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const success = await batchRemoveItemsFromCollection(
      id,
      session.userId,
      parsed.data.itemIds
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to batch remove items from collection:', error);
    return NextResponse.json(
      { error: 'Failed to remove items' },
      { status: 500 }
    );
  }
}
