/**
 * Admin API Validation Schemas
 *
 * Zod schemas for validating admin API request parameters and bodies.
 */

import { z } from 'zod';

// ============================================
// Package Moderation Schemas
// ============================================

/**
 * Query parameters for listing packages for admin review.
 */
export const listAdminPackagesQuerySchema = z.object({
  type: z.enum(['mcp', 'skill']).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'featured']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(['newest', 'oldest']).default('oldest'),
});

/**
 * Request body for approving a package.
 */
export const approvePackageSchema = z.object({
  note: z.string().max(1000).optional(),
});

/**
 * Request body for rejecting a package.
 */
export const rejectPackageSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
});

/**
 * Request body for featuring/unfeaturing a package.
 */
export const featurePackageSchema = z.object({
  featured: z.boolean(),
});

// ============================================
// Moderation Logs Schemas
// ============================================

/**
 * Query parameters for listing moderation logs.
 */
export const listLogsQuerySchema = z.object({
  entityType: z
    .enum(['mcp', 'skill', 'comment', 'collection', 'user', 'report'])
    .optional(),
  entityId: z.string().optional(),
  adminId: z.string().optional(),
  action: z
    .enum([
      'approve',
      'reject',
      'feature',
      'unfeature',
      'delete',
      'warn',
      'ban',
      'unban',
    ])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================
// Type Exports
// ============================================

export type ListAdminPackagesQuery = z.infer<typeof listAdminPackagesQuerySchema>;
export type ApprovePackageInput = z.infer<typeof approvePackageSchema>;
export type RejectPackageInput = z.infer<typeof rejectPackageSchema>;
export type FeaturePackageInput = z.infer<typeof featurePackageSchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
