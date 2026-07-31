import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { forkCollection } from '@/lib/services/collections';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Fork 合集
 * @summary Fork 合集
 * @description 复制指定合集到当前用户账号下，创建一份属于当前用户的合集副本。需要登录，合集不存在或无权访问时返回 404。成功后返回 `{ collection: forked }`，状态码 201。
 * @pathParams CollectionsParams
 * @response 201:CollectionsCreateResponse:合集 Fork 成功
 * @response 401:ErrorResponse:未登录
 * @response 404:ErrorResponse:合集不存在或无权访问
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
    const forked = await forkCollection(id, session.userId);

    if (!forked) {
      return NextResponse.json(
        { error: 'Collection not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ collection: forked }, { status: 201 });
  } catch (error) {
    console.error('Failed to fork collection:', error);
    return NextResponse.json(
      { error: 'Failed to fork collection' },
      { status: 500 }
    );
  }
}
