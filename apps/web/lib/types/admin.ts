/**
 * Admin Type Definitions
 *
 * Type definitions for the admin system including roles, permissions,
 * and moderation-related types.
 */

// ============================================
// User Roles
// ============================================

/**
 * User roles in the system.
 * - user: Regular user
 * - developer: Can publish packages
 * - support: Read-only admin access, can handle reports
 * - moderator: Can moderate packages and content
 * - admin: Legacy role, treated as super_admin
 * - super_admin: Full admin access
 */
export type UserRole =
  | 'user'
  | 'developer'
  | 'admin'
  | 'super_admin'
  | 'moderator'
  | 'support';

/**
 * Role levels for authorization.
 * Higher level = more permissions.
 */
export const ROLE_LEVELS: Record<UserRole, number> = {
  user: 0,
  developer: 0,
  support: 25,
  moderator: 50,
  admin: 100, // Legacy, treat as super_admin
  super_admin: 100,
};

/**
 * Admin roles that can access /admin routes.
 */
export const ADMIN_ROLES: UserRole[] = [
  'support',
  'moderator',
  'admin',
  'super_admin',
];

// ============================================
// Permissions
// ============================================

/**
 * Admin permissions for granular access control.
 */
export type AdminPermission =
  | 'admin.access' // Can access /admin routes
  | 'packages.review' // Review pending packages
  | 'packages.approve' // Approve/reject packages
  | 'packages.feature' // Feature/unfeature packages
  | 'content.moderate' // Moderate comments/collections
  | 'content.delete' // Delete content
  | 'users.view' // View user details
  | 'users.warn' // Send warnings to users
  | 'users.ban' // Ban/unban users
  | 'reports.view' // View reports
  | 'reports.resolve' // Resolve reports
  | 'admin.manage' // Manage other admins
  | 'categories.manage' // Manage page categories
  | 'topics.manage' // Manage moment topics/tags
  | 'rankings.view' // View ranking snapshots and items
  | 'rankings.manage' // Rebuild and configure rankings
  | 'operations.manage' // Manage operation slots and items
  | 'pages.review' // Review and moderate published pages
  | 'moments.moderate' // Moderate moments/dynamics
  | 'feedbacks.view' // View user feedbacks
  | 'feedbacks.resolve'; // Delete/resolve feedbacks

/**
 * All available admin permissions.
 */
export const ALL_PERMISSIONS: AdminPermission[] = [
  'admin.access',
  'packages.review',
  'packages.approve',
  'packages.feature',
  'content.moderate',
  'content.delete',
  'users.view',
  'users.warn',
  'users.ban',
  'reports.view',
  'reports.resolve',
  'admin.manage',
  'categories.manage',
  'topics.manage',
  'rankings.view',
  'rankings.manage',
  'operations.manage',
  'pages.review',
  'moments.moderate',
  'feedbacks.view',
  'feedbacks.resolve',
];

/**
 * Mapping of roles to their permissions.
 */
export const ROLE_PERMISSIONS: Record<UserRole, AdminPermission[]> = {
  user: [],
  developer: [],
  support: [
    'admin.access',
    'users.view',
    'reports.view',
    'reports.resolve',
    'rankings.view',
    'feedbacks.view',
  ],
  moderator: [
    'admin.access',
    'packages.review',
    'packages.approve',
    'packages.feature',
    'content.moderate',
    'content.delete',
    'users.view',
    'users.warn',
    'reports.view',
    'reports.resolve',
    'categories.manage',
    'topics.manage',
    'rankings.view',
    'rankings.manage',
    'operations.manage',
    'pages.review',
    'moments.moderate',
    'feedbacks.view',
    'feedbacks.resolve',
  ],
  // Legacy admin role - full permissions
  admin: ALL_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
};

// ============================================
// Package Status
// ============================================

/**
 * Package moderation status.
 */
export type PackageStatus = 'pending' | 'approved' | 'rejected' | 'featured';

// ============================================
// Reports
// ============================================

/**
 * Types of entities that can be reported.
 */
export type ReportEntityType =
  | 'mcp'
  | 'skill'
  | 'comment'
  | 'collection'
  | 'user';

/**
 * Reasons for reporting content.
 */
export type ReportReason =
  | 'spam'
  | 'inappropriate'
  | 'copyright'
  | 'security'
  | 'other';

/**
 * Status of a report.
 */
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

// ============================================
// Moderation Actions
// ============================================

/**
 * Types of entities that can be moderated.
 */
export type ModerationEntityType =
  | 'mcp'
  | 'skill'
  | 'comment'
  | 'collection'
  | 'user'
  | 'report'
  | 'moment'
  | 'published_page';

/**
 * Actions that can be performed during moderation.
 */
export type ModerationAction =
  | 'approve'
  | 'reject'
  | 'feature'
  | 'unfeature'
  | 'delete'
  | 'warn'
  | 'ban'
  | 'unban'
  | 'hide'
  | 'unhide';

// ============================================
// Helper Types
// ============================================

/**
 * User with admin role (for type narrowing).
 */
export interface AdminUser {
  id: string;
  username: string;
  userSlug: string;
  email: string;
  role: 'admin' | 'super_admin' | 'moderator' | 'support';
  avatarUrl?: string;
}

/**
 * Moderation log entry for audit trail.
 */
export interface ModerationLogEntry {
  id: string;
  adminId: string;
  entityType: ModerationEntityType;
  entityId: string;
  action: ModerationAction;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
