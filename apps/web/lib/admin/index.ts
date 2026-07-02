/**
 * Admin module
 *
 * Exports all admin-related functions for package moderation and logging.
 */

export {
  type AdminStats,
  type ActivityItem,
  type QueueItem,
  countPendingPackages,
  countOpenReports,
  countTodayActions,
  countTotalUsers,
  getRecentActivity,
  getPendingQueue,
  getAdminStats,
} from './stats';


// Re-export db and schema for transaction usage
export { db, mcpPackages, skillPackages, moderationLogs } from '@/lib/db';

// Package moderation functions
export {
  listPackagesForReview,
  getPackageDetails,
  updateMcpPackageStatus,
  updateSkillPackageStatus,
  deleteMcpPackage,
  deleteSkillPackage,
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
