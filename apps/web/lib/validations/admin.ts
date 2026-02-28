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
  type: z.enum(['mcp', 'skill']).nullish().transform(v => v ?? undefined),
  status: z.enum(['pending', 'approved', 'rejected', 'featured']).nullish().transform(v => v ?? undefined),
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
    .nullish().transform(v => v ?? undefined),
  entityId: z.string().nullish().transform(v => v ?? undefined),
  adminId: z.string().nullish().transform(v => v ?? undefined),
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
    .nullish().transform(v => v ?? undefined),
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
