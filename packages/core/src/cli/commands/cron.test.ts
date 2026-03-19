/**
 * Cron CLI Commands Tests
 *
 * Tests for the cron command implementation:
 * - cron list - List all cron jobs
 * - cron show <id> - Show job details
 * - cron add <name> - Add new cron job
 * - cron remove <id> - Remove cron job
 * - cron enable <id> - Enable cron job
 * - cron disable <id> - Disable cron job
 * - cron run <id> - Run job immediately
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { CronJob, JobStatus } from "../../cron/ops";
import { chalkMock } from "../../test/mocks/chalk";
import { createMockJob } from "../../test/factories/cron";
import { createCliTestContext, type CliTestContext } from "../../test/helpers/cli";
import { installFetchMock } from "../../test/mocks/fetch";

// =============================================================================
// Mocks - Hoisted
// =============================================================================

const {
  mockListJobs,
  mockGetJob,
  mockCreateJob,
  mockDeleteJob,
  mockEnableJob,
  mockDisableJob,
  mockGetExecutionLogs,
  mockFormatSchedule,
  mockFormatDuration,
  mockGetDefaultConfigPath,
} = vi.hoisted(() => ({
  mockListJobs: vi.fn(),
  mockGetJob: vi.fn(),
  mockCreateJob: vi.fn(),
  mockDeleteJob: vi.fn(),
  mockEnableJob: vi.fn(),
  mockDisableJob: vi.fn(),
  mockGetExecutionLogs: vi.fn(),
  mockFormatSchedule: vi.fn(),
  mockFormatDuration: vi.fn(),
  mockGetDefaultConfigPath: vi.fn(),
}));

// =============================================================================
// Module Mocks
// =============================================================================

vi.mock("../../cron/ops", () => ({
  listJobs: mockListJobs,
  getJob: mockGetJob,
  createJob: mockCreateJob,
  deleteJob: mockDeleteJob,
  enableJob: mockEnableJob,
  disableJob: mockDisableJob,
  getExecutionLogs: mockGetExecutionLogs,
  formatSchedule: mockFormatSchedule,
  formatDuration: mockFormatDuration,
  getDefaultConfigPath: mockGetDefaultConfigPath,
}));

vi.mock("chalk", () => chalkMock);

// Import after mocking
import { registerCronCommand } from "./cron";

// =============================================================================
// Test Suite
// =============================================================================

describe("Cron CLI Commands", () => {
  let ctx: CliTestContext;

  beforeEach(() => {
    ctx = createCliTestContext(registerCronCommand);

    // Setup default mock behaviors
    mockGetDefaultConfigPath.mockReturnValue("/mock/config/cron.yaml");
    mockListJobs.mockResolvedValue({ success: true, jobs: [] });
    mockGetJob.mockResolvedValue({ success: false, error: "Job not found" });
    mockCreateJob.mockResolvedValue({ success: true, job: createMockJob() });
    mockDeleteJob.mockResolvedValue({ success: true });
    mockEnableJob.mockResolvedValue({ success: true, job: createMockJob({ enabled: true }) });
    mockDisableJob.mockResolvedValue({ success: true, job: createMockJob({ enabled: false }) });
    mockGetExecutionLogs.mockResolvedValue({ success: true, logs: [], total: 0 });
    mockFormatSchedule.mockImplementation((job: CronJob) =>
      job.cron || (job.every ? `every ${job.every}s` : "-")
    );
    mockFormatDuration.mockImplementation((ms: number) => `${ms}ms`);
  });

  afterEach(() => {
    ctx.cleanup();
  });

  // ===========================================================================
  // cron list
  // ===========================================================================

  describe("cron list", () => {
    it("should list all cron jobs", async () => {
      const mockJobs = [
        createMockJob({
          id: "daily-greeting",
          name: "Daily Greeting",
          cron: "0 9 * * *",
          agent: "main",
          last_status: "success" as JobStatus,
        }),
        createMockJob({
          id: "hourly-check",
          name: "Hourly Check",
          every: 3600,
          agent: "monitor",
          enabled: false,
        }),
      ];

      mockListJobs.mockResolvedValue({ success: true, jobs: mockJobs });

      await ctx.run(["cron", "list"]);

      expect(mockListJobs).toHaveBeenCalled();
      // Verify output contains job names and schedule info
      expect(ctx.console.hasLog("Daily Greeting") || ctx.console.hasLog("daily-greeting")).toBe(true);
      expect(ctx.console.hasLog("Hourly Check") || ctx.console.hasLog("hourly-check")).toBe(true);
    });

    it("should show message when no cron jobs exist", async () => {
      mockListJobs.mockResolvedValue({ success: true, jobs: [] });

      await ctx.run(["cron", "list"]);

      expect(mockListJobs).toHaveBeenCalled();
      expect(ctx.console.hasLog("No cron jobs")).toBe(true);
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockJobs = [createMockJob({ id: "test-job", cron: "0 * * * *" })];
      mockListJobs.mockResolvedValue({ success: true, jobs: mockJobs });

      await ctx.run(["--json", "cron", "list"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // cron show <id>
  // ===========================================================================

  describe("cron show <id>", () => {
    it("should show job details", async () => {
      const mockJob = createMockJob({
        id: "daily-greeting",
        name: "Daily Greeting",
        cron: "0 9 * * *",
        agent: "main",
        message: "Good morning!",
        channel: "telegram",
        last_status: "success" as JobStatus,
        last_run: Date.now() - 86400000,
        next_run: Date.now() + 86400000,
      });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["cron", "show", "daily-greeting"]);

      expect(mockGetJob).toHaveBeenCalledWith("/mock/config/cron.yaml", "daily-greeting");
      // Verify output contains job details
      expect(ctx.console.hasLog("Daily Greeting") || ctx.console.hasLog("daily-greeting")).toBe(true);
      expect(ctx.console.hasLog("0 9 * * *")).toBe(true);
    });

    it("should show error when job not found", async () => {
      mockGetJob.mockResolvedValue({ success: false, error: "Job not found: nonexistent" });

      await ctx.run(["cron", "show", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should output JSON for job show", async () => {
      const mockJob = createMockJob({ id: "test-job", cron: "0 * * * *" });
      mockGetJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["--json", "cron", "show", "test-job"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });

    it("should show script job details", async () => {
      const mockJob = createMockJob({
        id: "backup-job",
        name: "Backup Job",
        job_type: "script",
        cron: "0 0 * * *",
        script: "tar -czf backup.tar.gz /data",
        last_output: "Backup completed successfully",
      });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["cron", "show", "backup-job"]);

      // Verify output contains script job details
      expect(ctx.console.hasLog("Backup Job") || ctx.console.hasLog("backup-job")).toBe(true);
      expect(ctx.console.hasLog("script") || ctx.console.hasLog("tar")).toBe(true);
    });
  });

  // ===========================================================================
  // cron add --name <name>
  // ===========================================================================

  describe("cron add --name <name>", () => {
    it("should add a new cron job with cron expression", async () => {
      const mockJob = createMockJob({
        id: "daily-greeting",
        name: "Daily Greeting",
        cron: "0 9 * * *",
        agent: "main",
      });

      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Daily Greeting",
        "--cron", "0 9 * * *",
        "--agent-id", "main",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(ctx.console.hasLog("Created cron job")).toBe(true);
    });

    it("should add a new cron job with --every interval", async () => {
      const mockJob = createMockJob({
        id: "hourly-check",
        name: "Hourly Check",
        every: 3600,
        agent: "monitor",
      });

      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Hourly Check",
        "--every", "3600",
        "--agent-id", "monitor",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(ctx.console.hasLog("Created cron job")).toBe(true);
    });

    it("should add a cron job with --message", async () => {
      const mockJob = createMockJob({
        id: "daily-report",
        name: "Daily Report",
        cron: "0 17 * * 5",
        agent: "main",
        message: "Summarize this week's accomplishments",
      });

      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Daily Report",
        "--cron", "0 17 * * 5",
        "--message", "Summarize this week's accomplishments",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
    });

    it("should show error when neither --cron nor --every is provided", async () => {
      await ctx.run(["cron", "add", "--name", "Test Job"]);

      expect(mockCreateJob).not.toHaveBeenCalled();
      expect(ctx.console.hasError("Must specify either --cron or --every")).toBe(true);
    });

    it("should add a script job with --script option", async () => {
      const mockJob = createMockJob({
        id: "backup-job",
        name: "Backup Job",
        job_type: "script",
        cron: "0 0 * * *",
        script: "tar -czf backup.tar.gz /data",
      });

      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Backup Job",
        "--cron", "0 0 * * *",
        "--script", "tar -czf backup.tar.gz /data",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
    });

    it("should add a job with channel option", async () => {
      const mockJob = createMockJob({
        id: "telegram-job",
        name: "Telegram Notification",
        cron: "0 9 * * *",
        channel: "my-telegram",
      });

      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Telegram Notification",
        "--cron", "0 9 * * *",
        "--channel", "my-telegram",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
    });

    it("should output JSON when adding a job with --json flag", async () => {
      const mockJob = createMockJob({ id: "json-job", cron: "0 * * * *" });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["--json", "cron", "add", "--name", "JSON Job", "--cron", "0 * * * *"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });

    it("should use default agent-id when not specified", async () => {
      const mockJob = createMockJob({
        id: "default-agent-job",
        name: "Default Agent Job",
        cron: "0 * * * *",
        agent: "main",
      });

      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Default Agent Job",
        "--cron", "0 * * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ agent: "main" })
      );
    });

    it("should support short flag -n for --name", async () => {
      const mockJob = createMockJob({ id: "short-flag-job", cron: "0 * * * *" });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["cron", "add", "-n", "Short Flag Job", "--cron", "0 * * * *"]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(ctx.console.hasLog("Created cron job")).toBe(true);
    });
  });

  // ===========================================================================
  // cron remove <id>
  // ===========================================================================

  describe("cron remove <id>", () => {
    it("should remove a cron job", async () => {
      const mockJob = createMockJob({ id: "job-to-remove", name: "Job To Remove" });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });
      mockDeleteJob.mockResolvedValue({ success: true });

      await ctx.run(["cron", "remove", "job-to-remove"]);

      expect(mockDeleteJob).toHaveBeenCalledWith("/mock/config/cron.yaml", "job-to-remove");
      expect(ctx.console.hasLog("Removed cron job")).toBe(true);
    });

    it("should show error when job not found for removal", async () => {
      mockGetJob.mockResolvedValue({ success: false, error: "Job not found" });

      await ctx.run(["cron", "remove", "nonexistent"]);

      expect(mockDeleteJob).not.toHaveBeenCalled();
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should output JSON when removing a job", async () => {
      const mockJob = createMockJob({ id: "job-to-remove" });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });
      mockDeleteJob.mockResolvedValue({ success: true });

      await ctx.run(["--json", "cron", "remove", "job-to-remove"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // cron enable <id>
  // ===========================================================================

  describe("cron enable <id>", () => {
    it("should enable a cron job", async () => {
      const mockJob = createMockJob({
        id: "disabled-job",
        name: "Disabled Job",
        enabled: true,
        next_run: Date.now() + 3600000,
      });

      mockEnableJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["cron", "enable", "disabled-job"]);

      expect(mockEnableJob).toHaveBeenCalledWith("/mock/config/cron.yaml", "disabled-job");
      expect(ctx.console.hasLog("Enabled cron job")).toBe(true);
    });

    it("should show Gateway note after enabling", async () => {
      const mockJob = createMockJob({
        id: "disabled-job",
        enabled: true,
        next_run: Date.now() + 3600000,
      });

      mockEnableJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["cron", "enable", "disabled-job"]);

      expect(ctx.console.hasLog("Scheduling takes effect when Gateway is running")).toBe(true);
    });

    it("should output JSON when enabling a job", async () => {
      const mockJob = createMockJob({ id: "disabled-job", enabled: true });
      mockEnableJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["--json", "cron", "enable", "disabled-job"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // cron disable <id>
  // ===========================================================================

  describe("cron disable <id>", () => {
    it("should disable a cron job", async () => {
      const mockJob = createMockJob({
        id: "enabled-job",
        name: "Enabled Job",
        enabled: false,
      });

      mockDisableJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["cron", "disable", "enabled-job"]);

      expect(mockDisableJob).toHaveBeenCalledWith("/mock/config/cron.yaml", "enabled-job");
      expect(ctx.console.hasLog("Disabled cron job")).toBe(true);
    });

    it("should output JSON when disabling a job", async () => {
      const mockJob = createMockJob({ id: "enabled-job", enabled: false });
      mockDisableJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run(["--json", "cron", "disable", "enabled-job"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // cron run <id>
  // ===========================================================================

  describe("cron run <id>", () => {
    let fetchCtx: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
      fetchCtx = installFetchMock();
    });

    afterEach(() => {
      fetchCtx.cleanup();
    });

    it("should run a cron job immediately", async () => {
      const mockJob = createMockJob({
        id: "run-job",
        name: "Run Job",
        last_status: "success" as JobStatus,
        last_output: "Job output",
      });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });
      fetchCtx.mock.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await ctx.run(["cron", "run", "run-job"]);

      expect(fetchCtx.mock).toHaveBeenCalledWith(
        "http://127.0.0.1:18790/api/cron/run-job/run",
        { method: "POST" }
      );
      expect(ctx.console.hasLog("Triggered job")).toBe(true);
    });

    it("should show error when job not found for running", async () => {
      mockGetJob.mockResolvedValue({ success: false, error: "Job not found" });

      await ctx.run(["cron", "run", "nonexistent"]);

      expect(fetchCtx.mock).not.toHaveBeenCalled();
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should show error when Gateway API fails", async () => {
      const mockJob = createMockJob({ id: "failing-job" });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });
      fetchCtx.mock.mockResolvedValue(
        new Response(JSON.stringify({ error: "Job execution failed" }), { status: 500 })
      );

      await ctx.run(["cron", "run", "failing-job"]);

      expect(ctx.console.hasError("Failed to run job")).toBe(true);
    });

    it("should show error when Gateway is not running", async () => {
      const mockJob = createMockJob({ id: "output-job" });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });
      fetchCtx.mock.mockRejectedValue(new Error("Connection refused"));

      await ctx.run(["cron", "run", "output-job"]);

      expect(ctx.console.hasError("Failed to connect")).toBe(true);
    });

    it("should output JSON when running a job", async () => {
      const mockJob = createMockJob({ id: "run-job", last_status: "success" as JobStatus });

      mockGetJob.mockResolvedValue({ success: true, job: mockJob });
      fetchCtx.mock.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      await ctx.run(["--json", "cron", "run", "run-job"]);

      expect(ctx.console.hasLog('"success": true')).toBe(true);
    });
  });

  // ===========================================================================
  // Cron Expression Format
  // ===========================================================================

  describe("cron expression support", () => {
    it("should accept standard cron expression format", async () => {
      const mockJob = createMockJob({ id: "standard-cron", cron: "30 8 * * 1-5" });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Standard Cron",
        "--cron", "30 8 * * 1-5",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ cron: "30 8 * * 1-5" })
      );
    });

    it("should accept cron expression with step values", async () => {
      const mockJob = createMockJob({ id: "step-cron", cron: "0 */2 * * *" });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Step Cron",
        "--cron", "0 */2 * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ cron: "0 */2 * * *" })
      );
    });

    it("should accept monthly cron expression", async () => {
      const mockJob = createMockJob({ id: "monthly-cron", cron: "0 0 1 * *" });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Monthly Cron",
        "--cron", "0 0 1 * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ cron: "0 0 1 * *" })
      );
    });
  });

  // ===========================================================================
  // Interval Support
  // ===========================================================================

  describe("interval support with --every", () => {
    it("should accept interval in seconds", async () => {
      const mockJob = createMockJob({ id: "interval-job", every: 300 });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Interval Job",
        "--every", "300",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ every: 300 })
      );
    });

    it("should accept hourly interval", async () => {
      const mockJob = createMockJob({ id: "hourly-job", every: 3600 });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Hourly Job",
        "--every", "3600",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ every: 3600 })
      );
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("error handling", () => {
    it("should handle service errors gracefully for list", async () => {
      mockListJobs.mockRejectedValue(new Error("Service unavailable"));

      let errorThrown = false;
      try {
        await ctx.run(["cron", "list"]);
      } catch {
        errorThrown = true;
      }

      // Should either throw or log an error containing relevant message
      if (!errorThrown) {
        expect(ctx.console.errors.length).toBeGreaterThan(0);
        expect(ctx.console.errors.some(e => e.includes("Service") || e.includes("unavailable") || e.includes("error"))).toBe(true);
      }
    });

    it("should handle enable job error for non-existent job", async () => {
      mockEnableJob.mockRejectedValue(new Error("Job not found: nonexistent"));

      let errorThrown = false;
      try {
        await ctx.run(["cron", "enable", "nonexistent"]);
      } catch {
        errorThrown = true;
      }

      // Should either throw or log an error about job not found
      if (!errorThrown) {
        expect(ctx.console.errors.length).toBeGreaterThan(0);
        expect(ctx.console.errors.some(e => e.includes("not found") || e.includes("nonexistent"))).toBe(true);
      }
    });

    it("should handle disable job error for non-existent job", async () => {
      mockDisableJob.mockRejectedValue(new Error("Job not found: nonexistent"));

      let errorThrown = false;
      try {
        await ctx.run(["cron", "disable", "nonexistent"]);
      } catch {
        errorThrown = true;
      }

      // Should either throw or log an error about job not found
      if (!errorThrown) {
        expect(ctx.console.errors.length).toBeGreaterThan(0);
        expect(ctx.console.errors.some(e => e.includes("not found") || e.includes("nonexistent"))).toBe(true);
      }
    });

    it("should handle duplicate job error", async () => {
      mockCreateJob.mockRejectedValue(new Error("Job already exists: existing-job"));

      let errorThrown = false;
      try {
        await ctx.run([
          "cron", "add",
          "--name", "Existing Job",
          "--cron", "0 * * * *",
        ]);
      } catch {
        errorThrown = true;
      }

      // Should either throw or log an error about duplicate job
      if (!errorThrown) {
        expect(ctx.console.errors.length).toBeGreaterThan(0);
        expect(ctx.console.errors.some(e => e.includes("already exists") || e.includes("existing-job"))).toBe(true);
      }
    });

    it("should handle delete error", async () => {
      mockGetJob.mockResolvedValue({ success: true, job: createMockJob({ id: "delete-error-job" }) });
      mockDeleteJob.mockRejectedValue(new Error("Failed to delete job"));

      let errorThrown = false;
      try {
        await ctx.run(["cron", "remove", "delete-error-job"]);
      } catch {
        errorThrown = true;
      }

      // Should either throw or log an error about delete failure
      if (!errorThrown) {
        expect(ctx.console.errors.length).toBeGreaterThan(0);
        expect(ctx.console.errors.some(e => e.includes("delete") || e.includes("Failed") || e.includes("error"))).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Format Helpers
  // ===========================================================================

  describe("format helpers", () => {
    it("should format schedule with cron expression in list", async () => {
      const mockJobs = [createMockJob({ id: "cron-job", cron: "0 9 * * *" })];
      mockListJobs.mockResolvedValue({ success: true, jobs: mockJobs });

      await ctx.run(["cron", "list"]);

      expect(ctx.console.logs.join("\n")).toContain("cron");
    });

    it("should format schedule with interval in seconds in list", async () => {
      const mockJobs = [createMockJob({ id: "interval-job", every: 30 })];
      mockListJobs.mockResolvedValue({ success: true, jobs: mockJobs });

      await ctx.run(["cron", "list"]);

      expect(ctx.console.logs.join("\n")).toContain("every");
    });

    it("should format enabled status correctly in list", async () => {
      const mockJobs = [
        createMockJob({ id: "enabled-job", enabled: true, cron: "0 * * * *" }),
        createMockJob({ id: "disabled-job", enabled: false, cron: "0 * * * *" }),
      ];

      mockListJobs.mockResolvedValue({ success: true, jobs: mockJobs });

      await ctx.run(["cron", "list"]);

      // Verify both jobs are listed with their IDs
      expect(ctx.console.hasLog("enabled-job")).toBe(true);
      expect(ctx.console.hasLog("disabled-job")).toBe(true);
    });

    it("should format job status correctly in list", async () => {
      const mockJobs = [
        createMockJob({ id: "success-job", cron: "0 * * * *", last_status: "success" as JobStatus }),
        createMockJob({ id: "failure-job", cron: "0 * * * *", last_status: "failure" as JobStatus }),
        createMockJob({ id: "running-job", cron: "0 * * * *", last_status: "running" as JobStatus }),
      ];

      mockListJobs.mockResolvedValue({ success: true, jobs: mockJobs });

      await ctx.run(["cron", "list"]);

      // Verify all jobs are listed
      expect(ctx.console.hasLog("success-job")).toBe(true);
      expect(ctx.console.hasLog("failure-job")).toBe(true);
      expect(ctx.console.hasLog("running-job")).toBe(true);
    });
  });

  // ===========================================================================
  // Job Types
  // ===========================================================================

  describe("job types", () => {
    it("should create agent type job by default", async () => {
      const mockJob = createMockJob({ id: "agent-job", job_type: "agent", cron: "0 * * * *" });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Agent Job",
        "--cron", "0 * * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({ job_type: "agent" })
      );
    });

    it("should create script type job when --script is provided", async () => {
      const mockJob = createMockJob({
        id: "script-job",
        job_type: "script",
        cron: "0 * * * *",
        script: "echo hello",
      });
      mockCreateJob.mockResolvedValue({ success: true, job: mockJob });

      await ctx.run([
        "cron", "add",
        "--name", "Script Job",
        "--cron", "0 * * * *",
        "--script", "echo hello",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        "/mock/config/cron.yaml",
        expect.objectContaining({
          job_type: "script",
          script: "echo hello",
        })
      );
    });
  });
});
