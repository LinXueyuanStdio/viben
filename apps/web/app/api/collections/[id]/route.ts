import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCollection, updateCollection, deleteCollection, listCollectionItems } from '@/lib/services/collections';
import { CollectionsUpdateBody } from '@/lib/validations/collections';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取合集详情
 * @summary 获取合集详情
 * @description 获取合集本身及其所有条目列表，返回 `{ collection, items }`。如用户已登录则传递 userId 以判断所有权和权限上下文。合集不存在时返回 404。
 * @pathParams CollectionsParams
 * @response 200:CollectionsDetailResponse:合集详情
 * @response 404:ErrorResponse:合集不存在
 * @response 500:ErrorResponse:服务器内部错误
 * @tag Collections
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    const { id } = await params;

    const collection = await getCollection(id, session?.userId);

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const items = await listCollectionItems(id, session?.userId);

    return NextResponse.json({ collection, items });
  } catch (error) {
    console.error('Failed to get collection:', error);
    return NextResponse.json(
      { error: 'Failed to get collection' },
      { status: 500 }
    );
  }
}

/**
 * 更新合集
 * @summary 更新合集
 * @description 部分更新合集信息，仅所有者可操作。请求体通过 Zod 验证，所有字段均为可选，仅更新提供的字段。slug 有唯一性和格式限制。
 * @pathParams CollectionsParams
 * @body CollectionsUpdateBody
 * @response 200:SuccessResponse:更新成功
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
    const parsed = CollectionsUpdateBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const collection = await updateCollection(id, session.userId, parsed.data);

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection });
  } catch (error) {
    if (error instanceof Error && error.message === 'Collection slug already exists') {
      return NextResponse.json(
        { error: 'Collection slug already exists' },
        { status: 409 }
      );
    }
    console.error('Failed to update collection:', error);
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
}

/**
 * 删除合集
 * @summary 删除合集
 * @description 删除合集，仅所有者可操作。合集不存在或非所有者操作时返回 404 以统一错误信息。成功后返回 `{ success: true }`。
 * @pathParams CollectionsParams
 * @response 200:SuccessResponse:删除成功
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
    const deleted = await deleteCollection(id, session.userId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete collection:', error);
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
