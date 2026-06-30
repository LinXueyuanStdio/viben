/**
 * Admin User Role API
 *
 * PATCH /api/admin/users/[id]/role - Change user role
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth';
import { db, users, moderationLogs } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateRoleSchema = z.object({
  role: z.enum(['user', 'developer', 'support', 'moderator', 'admin']),
  reason: z.string().optional(),
});

/**
 * PATCH /api/admin/users/[id]/role
 *
 * Change a user's role. Only allows switching between 'user' and 'developer'.
 * Admin roles cannot be assigned through this endpoint.
 *
 * Body:
 * - role: 'user' | 'developer'
 * - reason: string (optional, for audit log)
 *
 * Required permission: users.ban
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Verify admin permission
    const session = await requirePermission(request, 'users.ban');

    const { id } = await params;

    // Parse and validate body
    const body = await request.json();
    const { role, reason } = updateRoleSchema.parse(body);

    // Get the target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only super_admin/admin can manage admin roles
    const adminRoles = ['admin', 'super_admin', 'moderator', 'support'];
    const isSuperAdmin = session.role === 'super_admin' || session.role === 'admin';

    if (adminRoles.includes(targetUser.role) && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admin can change admin roles' },
        { status: 403 }
      );
    }

    // Prevent changing super_admin role (highest protection)
    if (targetUser.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot change super admin role' },
        { status: 403 }
      );
    }

    // Non-super-admin can only set user/developer
    if (!isSuperAdmin && adminRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Cannot assign admin roles' },
        { status: 403 }
      );
    }

    // Prevent self-demotion
    if (targetUser.id === session.userId) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    // Update the role
    await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id));

    // Log the action
    const isAdminAssign = adminRoles.includes(role);
    await db.insert(moderationLogs).values({
      adminId: session.userId,
      entityType: 'user',
      entityId: id,
      action: isAdminAssign ? 'unban' : 'ban',
      reason: reason || `Role changed from ${targetUser.role} to ${role}`,
      metadata: {
        previousRole: targetUser.role,
        newRole: role,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id,
        role,
        previousRole: targetUser.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Update user role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
