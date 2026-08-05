import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { or, like } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q || q.length < 2) return NextResponse.json({ users: [] });

  const pattern = `%${q}%`;
  const results = await db
    .select({
      userSlug: users.userSlug,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(or(
      like(users.username, pattern),
      like(users.displayName, pattern),
      like(users.email, pattern),
    ))
    .limit(10);

  return NextResponse.json({ users: results });
}
