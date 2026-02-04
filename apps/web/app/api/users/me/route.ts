import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, users } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { updateProfileSchema } from '@/lib/validations/user';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

// GET - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        websiteUrl: true,
        githubUsername: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update current user profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    // Filter out undefined values
    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio || null;
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.userId));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        websiteUrl: true,
        githubUsername: true,
        role: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
