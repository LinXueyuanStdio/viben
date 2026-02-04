import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { createApiKeySchema } from '@/lib/validations/user';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { ZodError } from 'zod';

// GET - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, session.userId),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
    });

    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('List API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { name, scopes, expiresIn } = createApiKeySchema.parse(body);

    // Generate key: bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYY
    const prefix = `bmcp_${generateId().slice(0, 8)}`;
    const secret = generateId().replace(/-/g, '') + generateId().replace(/-/g, '');
    const fullKey = `${prefix}_${secret.slice(0, 24)}`;

    const keyHash = await bcrypt.hash(fullKey, 12);

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;

    const keyId = generateId();
    await db.insert(apiKeys).values({
      id: keyId,
      userId: session.userId,
      name,
      keyHash,
      keyPrefix: prefix,
      scopes,
      expiresAt,
    });

    // Return the full key only once
    return NextResponse.json({
      id: keyId,
      key: fullKey,
      prefix,
      name,
      scopes,
      expiresAt,
      warning: 'Save this key now. You will not be able to see it again.',
    });
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
    console.error('Create API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
