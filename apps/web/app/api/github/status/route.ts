import { NextResponse } from 'next/server';
import { db, githubConnections } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';

/**
 * 获取 GitHub 连接状态
 * @description 检查当前用户是否已连接 GitHub，返回连接状态、用户名和连接时间
 * @response 200:{ connected: boolean; githubUsername?: string; connectedAt?: string }
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @tag GitHub
 * @ignore
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, session.userId),
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      githubUsername: connection.githubUsername,
      connectedAt: connection.connectedAt,
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 断开 GitHub 连接
 * @description 删除当前用户的 GitHub 连接记录，取消仓库访问授权
 * @response 200:SuccessResponse:断开成功
 * @response 404:ErrorResponse:未找到 GitHub 连接
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @tag GitHub
 * @ignore
 */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [deleted] = await db
      .delete(githubConnections)
      .where(eq(githubConnections.userId, session.userId))
      .returning({ id: githubConnections.id });

    if (!deleted) {
      return NextResponse.json(
        { error: 'No GitHub connection found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
