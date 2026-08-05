import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * 校验 team slug 是否可用
 * @summary 校验 team slug
 * @query slug: string — the slug to check
 * @response 200: { available: true } | { available: false, message: string }
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
