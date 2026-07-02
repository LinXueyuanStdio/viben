/**
 * Admin Users API
 *
 * GET /api/admin/users - List users for admin management
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { like, or, eq, desc, asc, count, and, type SQL } from 'drizzle-orm';
import { z } from 'zod';

const listUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['user', 'developer', 'admin', 'super_admin', 'moderator', 'support']).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

/**
 * GET /api/admin/users
 *
 * List users with filtering and pagination.
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - search: string (optional, searches username and email)
 * - role: 'user' | 'developer' | ... (optional)
 * - sort: 'newest' | 'oldest' (default: 'newest')
 *
 * Required permission: users.view
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin permission
    await requirePermission(request, 'users.view');

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = listUsersQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { page, limit, search, role, sort } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: SQL[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const searchCondition = or(
        like(users.username, searchPattern),
        like(users.email, searchPattern),
        like(users.displayName, searchPattern)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (role) {
      conditions.push(eq(users.role, role));
    }

    // Build where clause using drizzle's and() function
    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Get users
    const userList = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        bannedAt: users.bannedAt,
        warnedAt: users.warnedAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(sort === 'newest' ? desc(users.createdAt) : asc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      users: userList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
