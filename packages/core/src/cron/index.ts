/**
 * Cron module
 *
 * Provides cron job scheduling and management:
 * - CronService: Stateful service for scheduling and event broadcasting
 * - ops: Pure functions for CRUD, logs, and scheduling calculations
 *
 * Usage:
 * - Gateway: Use CronService for scheduling and event broadcasting
 * - CLI: Use ops functions directly for data operations
 */

// =============================================================================
// Service
// =============================================================================

export { CronService } from "./service";

// =============================================================================
// Operations (re-export from ops module)
// =============================================================================

// Types
export type {
  JobStatus,
  CronJobType,
  CronNotificationSettings,
  CronJob,
  CreateCronJob,
  UpdateCronJob,
  CronExecutionLog,
  CronConfig,
  ListJobsResult,
  GetJobResult,
  CreateJobResult,
  UpdateJobResult,
  DeleteJobResult,
  GetLogsResult,
  ClearLogsResult,
} from "./ops";

// CRUD operations
export {
  getDefaultConfigPath,
  getLogDir,
  getLogPath,
  loadConfig,
  saveConfig,
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  enableJob,
  disableJob,
  updateJobStatus,
} from "./ops";

// Log operations
export {
  MAX_LOG_OUTPUT_LENGTH,
  MAX_LOG_ENTRIES_PER_JOB,
  generateExecutionId,
  appendExecutionLog,
  rotateLogsIfNeeded,
  getExecutionLogs,
  clearExecutionLogs,
  truncateOutput,
} from "./ops";

// Schedule utilities
export {
  getNextCronTime,
  getNextIntervalTime,
  calculateNextRun,
  formatSchedule,
  formatTimestamp,
  formatDuration,
} from "./ops";

// Namespace export for convenience
export * as cronOps from "./ops";
