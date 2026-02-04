import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, users, mcpPackages, skillPackages } from '@/lib/db';
import { eq, count } from 'drizzle-orm';

// GET - Public user profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        websiteUrl: true,
        githubUsername: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get package counts
    const [mcpCount] = await db
      .select({ count: count() })
      .from(mcpPackages)
      .where(eq(mcpPackages.authorId, user.id));

    const [skillCount] = await db
      .select({ count: count() })
      .from(skillPackages)
      .where(eq(skillPackages.authorId, user.id));

    return NextResponse.json({
      user: {
        ...user,
        stats: {
          mcpPackages: mcpCount?.count ?? 0,
          skillPackages: skillCount?.count ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
