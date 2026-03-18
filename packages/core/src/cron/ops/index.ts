/**
 * Cron operations module
 *
 * Re-exports all cron-related operations for use by commands and other modules.
 *
 * Module structure:
 * - types.ts     - Type definitions (CronJob, CreateCronJob, etc.)
 * - crud.ts      - CRUD operations (listJobs, createJob, etc.)
 * - logs.ts      - Execution log operations (appendLog, getLogs, etc.)
 * - schedule.ts  - Scheduling utilities (getNextCronTime, formatSchedule, etc.)
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Core types
  JobStatus,
  CronJobType,
  CronNotificationSettings,
  CronJob,
  CreateCronJob,
  UpdateCronJob,
  CronExecutionLog,
  CronConfig,
  // Result types
  ListJobsResult,
  GetJobResult,
  CreateJobResult,
  UpdateJobResult,
  DeleteJobResult,
  GetLogsResult,
  ClearLogsResult,
} from "./types";

// =============================================================================
// CRUD Operations
// =============================================================================

export {
  // Config paths
  getDefaultConfigPath,
  getLogDir,
  getLogPath,
  // Config file operations
  loadConfig,
  saveConfig,
  // CRUD
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  enableJob,
  disableJob,
  updateJobStatus,
} from "./crud";

// =============================================================================
// Log Operations
// =============================================================================

export {
  // Constants
  MAX_LOG_OUTPUT_LENGTH,
  MAX_LOG_ENTRIES_PER_JOB,
  // Functions
  generateExecutionId,
  appendExecutionLog,
  rotateLogsIfNeeded,
  getExecutionLogs,
  clearExecutionLogs,
  truncateOutput,
} from "./logs";

// =============================================================================
// Schedule Utilities
// =============================================================================

export {
  // Time calculations
  getNextCronTime,
  getPrevCronTime,
  getNextIntervalTime,
  calculateNextRun,
  // Validation
  isValidCronExpression,
  // Formatting
  formatSchedule,
  formatTimestamp,
  formatDuration,
} from "./schedule";
