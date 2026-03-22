/**
 * Cron job test factories
 */
import type { CronJob, JobStatus, CronExecutionLog } from "../../cron/ops";

/**
 * Create a mock cron job with sensible defaults
 */
export function createMockJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "test-job",
    name: "Test Job",
    enabled: true,
    job_type: "agent",
    agent: "main",
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

/**
 * Create multiple mock jobs
 */
export function createMockJobs(
  count: number,
  overrides?: (index: number) => Partial<CronJob>
): CronJob[] {
  return Array.from({ length: count }, (_, i) =>
    createMockJob({
      id: `job-${i + 1}`,
      name: `Job ${i + 1}`,
      ...overrides?.(i),
    })
  );
}

/**
 * Create a mock execution log
 */
export function createMockExecutionLog(
  overrides: Partial<CronExecutionLog> = {}
): CronExecutionLog {
  const now = Date.now();
  return {
    execution_id: "log-1",
    job_id: "test-job",
    job_name: "Test Job",
    job_type: "agent",
    agent: "main",
    started_at: now - 1000,
    completed_at: now,
    duration_ms: 1000,
    status: "success" as JobStatus,
    output: "Job completed successfully",
    output_length: 26,
    trigger: "scheduled",
    ...overrides,
  };
}

/**
 * Create mock execution logs
 */
export function createMockExecutionLogs(
  count: number,
  jobId = "test-job"
): CronExecutionLog[] {
  return Array.from({ length: count }, (_, i) =>
    createMockExecutionLog({
      execution_id: `log-${i + 1}`,
      job_id: jobId,
      started_at: Date.now() - (count - i) * 60000,
      completed_at: Date.now() - (count - i) * 60000 + 1000,
    })
  );
}
