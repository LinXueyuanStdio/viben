import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  listPublicCollections,
  listUserCollections,
  createCollection,
} from '@/lib/services/collections';
import { CollectionsCreateBody } from '@/lib/validations/collections';

/**
 * 获取合集列表
 * @summary 获取合集列表
 * @description 查询公开合集（默认）或当前用户的合集（?mine=true 时需登录），返回 `{ collections }` 数组。公开查询无需登录，个人合集查询需有效的 session。
 * @params CollectionsListQuery
 * @response 200:CollectionsListResponse:合集列表
 * @response 401:ErrorResponse:未登录（mine=true 时）
 * @response 500:ErrorResponse:服务器内部错误
 * @tag Collections
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const mine = request.nextUrl.searchParams.get('mine') === 'true';

    if (mine) {
      if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const collections = await listUserCollections(session.userId);
      return NextResponse.json({ collections });
    }

    const collections = await listPublicCollections();
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Failed to list collections:', error);
    return NextResponse.json(
      { error: 'Failed to list collections' },
      { status: 500 }
    );
  }
}

/**
 * 创建合集
 * @summary 创建合集
 * @description 创建一个新合集，slug 不提供则自动生成。需登录，仅所有者可操作。请求体通过 Zod 验证，slug 有格式限制（小写字母、数字和连字符）。
 * @body CollectionsCreateBody
 * @response 201:CollectionsCreateResponse:创建成功
 * @response 400:ErrorResponse:请求参数无效
 * @response 401:ErrorResponse:未登录
 * @response 409:ErrorResponse:slug 已被占用
 * @responseSet auth
 * @auth bearer
 * @tag Collections
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CollectionsCreateBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const collection = await createCollection(session.userId, parsed.data);

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Collection slug already exists') {
      return NextResponse.json(
        { error: 'Collection slug already exists' },
        { status: 409 }
      );
    }
    console.error('Failed to create collection:', error);
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}
