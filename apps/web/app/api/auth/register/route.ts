import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { registerSchema } from '@/lib/validations/user';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, username, password, displayName } = registerSchema.parse(body);

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: (u, { or, eq }) => or(eq(u.email, email), eq(u.username, username)),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email or username already taken' },
        { status: 400 }
      );
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      email,
      username,
      displayName,
      passwordHash,
      role: 'user',
    });

    // Set session
    await setSessionCookie({
      userId,
      username,
      email,
      role: 'user',
    });

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
