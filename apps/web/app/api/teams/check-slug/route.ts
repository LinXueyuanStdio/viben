import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * 校验团队 slug 是否可用
 * @summary 校验团队 slug
 * @description 检查指定的 slug 是否可用。返回 `{ available: true }` 表示可用，`{ available: false, message: string }` 表示不可用及原因。slug 格式只允许小写字母、数字和连字符。
 * @query slug:string — 要校验的 slug
 * @response 200:{ available: boolean, message?: string }:校验结果
 * @response 400:ErrorResponse:缺少 slug 或格式无效
 * @tag Teams
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug || slug.length < 1) {
    return NextResponse.json(
      { available: false, message: 'Slug is required' },
      { status: 400 }
    );
  }

  // slug 格式校验：只允许小写字母、数字、连字符
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { available: false, message: 'Slug must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 }
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { available: false, message: `The name '${slug}' is already taken.` },
      { status: 200 }
    );
  }

  return NextResponse.json({ available: true });
}
