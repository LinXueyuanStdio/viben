/**
 * Admin Authorization Middleware
 *
 * Provides RBAC (Role-Based Access Control) for admin functionality.
 * Includes middleware helpers and permission checking utilities.
 */

import type { NextRequest } from 'next/server';
import { resolveSessionFromAccessToken } from './session-service';
import { ACCESS_COOKIE } from './token';
import { validateApiKey } from './api-key';
import { AuthError } from './middleware';
import type { Session } from './types';
import {
  type UserRole,
  type AdminPermission,
  ROLE_LEVELS,
  ROLE_PERMISSIONS,
  ADMIN_ROLES,
} from '../types/admin';

// ============================================
// Permission Checking
// ============================================

/**
 * Check if a user role has a specific permission.
 *
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns true if the role has the permission
 *
 * @example
 * ```ts
 * if (hasPermission(user.role, 'packages.approve')) {
 *   // User can approve packages
 * }
 * ```
 */
export function hasPermission(
  role: string,
  permission: AdminPermission
): boolean {
  const permissions = ROLE_PERMISSIONS[role as UserRole] ?? [];
  return permissions.includes(permission);
}

/**
 * Check if a user role has all of the specified permissions.
 *
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has all permissions
 */
export function hasAllPermissions(
  role: string,
  permissions: AdminPermission[]
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a user role has any of the specified permissions.
 *
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has at least one permission
 */
export function hasAnyPermission(
  role: string,
  permissions: AdminPermission[]
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get all permissions for a role.
 *
 * @param role - The user's role
 * @returns Array of permissions the role has
 */
export function getPermissions(role: string): AdminPermission[] {
  return ROLE_PERMISSIONS[role as UserRole] ?? [];
}

/**
 * Check if a role is an admin role.
 *
 * @param role - The user's role
 * @returns true if the role has admin access
 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

/**
 * Get the authorization level for a role.
 *
 * @param role - The user's role
 * @returns The role's authorization level (0-100)
 */
export function getRoleLevel(role: string): number {
  return ROLE_LEVELS[role as UserRole] ?? 0;
}

// ============================================
// Authentication Helpers
// ============================================

/**
 * Authenticate a request from either a session cookie or an API key.
 *
 * Tries session cookie first, then falls back to Bearer token in the
 * Authorization header (validated against the api_keys table).
 *
 * @returns The session if authenticated, null otherwise.
 */
async function authenticateRequest(request: NextRequest): Promise<Session | null> {
  // 1. Session cookie
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    const session = await resolveSessionFromAccessToken(token);
    if (session) return session;
  }

  // 2. API Key via Authorization: Bearer <key>
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const user = await validateApiKey(match[1]);
      if (user) {
        return {
          userId: user.id,
          username: user.username,
          userSlug: user.userSlug,
          email: user.email,
          role: user.role,
          expiresAt: Date.now() + 3600000,
        };
      }
    }
  }

  return null;
}

// ============================================
// Middleware Helpers
// ============================================

/**
 * Require admin access with minimum level.
 *
 * @param request - The Next.js request object
 * @param minLevel - Minimum authorization level required (default: 25 for support)
 * @returns The session if authorized
 * @throws AuthError if not authorized
 *
 * @example
 * ```ts
 * // In an API route
 * export async function GET(request: NextRequest) {
 *   const session = await requireAdmin(request);
 *   // User has admin access
 * }
 *
 * // Require moderator level (50)
 * export async function POST(request: NextRequest) {
 *   const session = await requireAdmin(request, 50);
 *   // User is at least a moderator
 * }
 * ```
 */
export async function requireAdmin(
  request: NextRequest,
  minLevel: number = 25
): Promise<Session> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    throw new AuthError('Authentication required', 401);
  }

  const session = await resolveSessionFromAccessToken(token);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  const roleLevel = getRoleLevel(session.role);

  if (roleLevel < minLevel) {
    throw new AuthError('Insufficient permissions', 403);
  }

  return session;
}

/**
 * Require a specific permission.
 *
 * @param request - The Next.js request object
 * @param permission - The permission required
 * @returns The session if authorized
 * @throws AuthError if not authorized
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const session = await requirePermission(request, 'packages.approve');
 *   // User can approve packages
 * }
 * ```
 */
export async function requirePermission(
  request: NextRequest,
  permission: AdminPermission
): Promise<Session> {
  const session = await authenticateRequest(request);

  if (!session) {
    throw new AuthError('Authentication required', 401);
  }

  if (!hasPermission(session.role, permission)) {
    throw new AuthError(`Missing permission: ${permission}`, 403);
  }

  return session;
}

/**
 * Require any of the specified permissions.
 *
 * @param request - The Next.js request object
 * @param permissions - Array of permissions, user needs at least one
 * @returns The session if authorized
 * @throws AuthError if not authorized
 *
 * @example
 * ```ts
 * export async function DELETE(request: NextRequest) {
 *   const session = await requireAnyPermission(request, [
 *     'content.delete',
 *     'admin.manage'
 *   ]);
 *   // User can delete content OR manage admins
 * }
 * ```
 */
export async function requireAnyPermission(
  request: NextRequest,
  permissions: AdminPermission[]
): Promise<Session> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    throw new AuthError('Authentication required', 401);
  }

  const session = await resolveSessionFromAccessToken(token);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  if (!hasAnyPermission(session.role, permissions)) {
    throw new AuthError(
      `Missing permissions: requires one of [${permissions.join(', ')}]`,
      403
    );
  }

  return session;
}

/**
 * Require all of the specified permissions.
 *
 * @param request - The Next.js request object
 * @param permissions - Array of permissions, user needs all of them
 * @returns The session if authorized
 * @throws AuthError if not authorized
 *
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const session = await requireAllPermissions(request, [
 *     'packages.review',
 *     'packages.approve'
 *   ]);
 *   // User can review AND approve packages
 * }
 * ```
 */
export async function requireAllPermissions(
  request: NextRequest,
  permissions: AdminPermission[]
): Promise<Session> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    throw new AuthError('Authentication required', 401);
  }

  const session = await resolveSessionFromAccessToken(token);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  if (!hasAllPermissions(session.role, permissions)) {
    const missing = permissions.filter((p) => !hasPermission(session.role, p));
    throw new AuthError(`Missing permissions: [${missing.join(', ')}]`, 403);
  }

  return session;
}

// ============================================
// Session Helpers
// ============================================

/**
 * Get session with admin info if the user is an admin.
 * Does not throw if user is not an admin, just returns null.
 *
 * @param request - The Next.js request object
 * @returns Session if user is an admin, null otherwise
 */
export async function getAdminSession(
  request: NextRequest
): Promise<Session | null> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await resolveSessionFromAccessToken(token);

  if (!session) {
    return null;
  }

  if (!isAdminRole(session.role)) {
    return null;
  }

  return session;
}
