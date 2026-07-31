import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * 获取当前用户的包列表
 * @description 获取当前登录用户发布的 MCP 包和 Skill 包列表，各最多返回 10 条，按创建时间降序排列。MCP 包字段含 id、name、slug、description、version、transport、createdAt；Skill 包字段含 id、name、slug、description、version、skillType、createdAt。需登录后调用，未登录返回 401。
 * @response 200:UserPackagesResponse:用户的 MCP 包（mcps）和 Skill 包（skills）列表
 * @response 401:ErrorResponse:未登录
 * @response 500:ErrorResponse:查询失败
 * @responseSet auth
 * @auth bearer
 * @tag Users
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [mcps, skills] = await Promise.all([
      db.query.mcpPackages.findMany({
        where: eq(mcpPackages.authorId, session.userId),
        orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
        limit: 10,
      }),
      db.query.skillPackages.findMany({
        where: eq(skillPackages.authorId, session.userId),
        orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
        limit: 10,
      }),
    ]);

    return NextResponse.json({ mcps, skills });
  } catch (error) {
    console.error('Failed to fetch user packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}
