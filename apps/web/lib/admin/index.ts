/**
 * Admin Module
 *
 * Exports all admin-related functions for package moderation and logging.
 */

// Re-export db and schema for transaction usage
export { db, mcpPackages, skillPackages, moderationLogs } from '@/lib/db';

// Package moderation functions
export {
  listPackagesForReview,
  getPackageDetails,
  updateMcpPackageStatus,
  updateSkillPackageStatus,
  getPackageType,
  getPackageStatus,
  getPackageName,
  type PackageForReview,
  type PackageDetails,
  type PackageAuthor,
  type ReviewHistoryEntry,
  type ListPackagesOptions,
  type ListPackagesResult,
} from './packages';

// Moderation log functions
export {
  createModerationLog,
  listModerationLogs,
  type ModerationLogEntry,
  type ListLogsOptions,
  type ListLogsResult,
  type CreateLogOptions,
} from './logs';
