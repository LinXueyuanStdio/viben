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
import { Command } from "commander";
import type { CronJob, JobStatus } from "../../services";

// Hoist mock functions so they're available when vi.mock runs
const { mockLoad, mockListJobs, mockGetJob, mockCreateJob, mockDeleteJob, mockEnableJob, mockDisableJob, mockRunJob, mockShutdown } = vi.hoisted(() => ({
  mockLoad: vi.fn(),
  mockListJobs: vi.fn(),
  mockGetJob: vi.fn(),
  mockCreateJob: vi.fn(),
  mockDeleteJob: vi.fn(),
  mockEnableJob: vi.fn(),
  mockDisableJob: vi.fn(),
  mockRunJob: vi.fn(),
  mockShutdown: vi.fn(),
}));

// Mock the services module BEFORE importing cron module
vi.mock("../../services", () => ({
  CronService: vi.fn().mockImplementation(() => ({
    load: mockLoad,
    listJobs: mockListJobs,
    getJob: mockGetJob,
    createJob: mockCreateJob,
    deleteJob: mockDeleteJob,
    enableJob: mockEnableJob,
    disableJob: mockDisableJob,
    runJob: mockRunJob,
    shutdown: mockShutdown,
  })),
  eventService: {
    broadcast: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

// Mock chalk to avoid color output in tests
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    blue: (s: string) => s,
  },
}));

// Import after mocking
import { registerCronCommand } from "./cron";

/**
 * Helper to create a mock cron job
 */
function createMockJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "test-job",
    name: "Test Job",
    enabled: true,
    jobType: "agent",
    agent: "main",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("Cron CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register cron commands
    registerCronCommand(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Reset all mocks to their default behaviors
    mockLoad.mockResolvedValue(undefined);
    mockListJobs.mockResolvedValue([]);
    mockGetJob.mockResolvedValue(null);
    mockCreateJob.mockResolvedValue(createMockJob());
    mockDeleteJob.mockResolvedValue(undefined);
    mockEnableJob.mockResolvedValue(createMockJob({ enabled: true }));
    mockDisableJob.mockResolvedValue(createMockJob({ enabled: false }));
    mockRunJob.mockResolvedValue(undefined);
    mockShutdown.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper to run command
  // ============================================================================
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // ============================================================================
  // cron list Tests
  // ============================================================================

  describe("cron list", () => {
    it("should list all cron jobs", async () => {
      const mockJobs = [
        createMockJob({
          id: "daily-greeting",
          name: "Daily Greeting",
          cron: "0 9 * * *",
          agent: "main",
          lastStatus: "success" as JobStatus,
        }),
        createMockJob({
          id: "hourly-check",
          name: "Hourly Check",
          every: 3600,
          agent: "monitor",
          enabled: false,
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      expect(mockLoad).toHaveBeenCalled();
      expect(mockListJobs).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show message when no cron jobs exist", async () => {
      mockListJobs.mockResolvedValue([]);

      await runCommand(["cron", "list"]);

      expect(mockListJobs).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No cron jobs"));
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockJobs = [
        createMockJob({
          id: "test-job",
          name: "Test Job",
          cron: "0 * * * *",
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["--json", "cron", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // cron show <id> Tests
  // ============================================================================

  describe("cron show <id>", () => {
    it("should show job details", async () => {
      const mockJob = createMockJob({
        id: "daily-greeting",
        name: "Daily Greeting",
        cron: "0 9 * * *",
        agent: "main",
        message: "Good morning!",
        channel: "telegram",
        lastStatus: "success" as JobStatus,
        lastRun: Date.now() - 86400000,
        nextRun: Date.now() + 86400000,
      });

      mockGetJob.mockResolvedValue(mockJob);

      await runCommand(["cron", "show", "daily-greeting"]);

      expect(mockGetJob).toHaveBeenCalledWith("daily-greeting");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show error when job not found", async () => {
      mockGetJob.mockResolvedValue(null);

      await runCommand(["cron", "show", "nonexistent"]);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON for job show", async () => {
      const mockJob = createMockJob({
        id: "test-job",
        name: "Test Job",
        cron: "0 * * * *",
      });

      mockGetJob.mockResolvedValue(mockJob);

      await runCommand(["--json", "cron", "show", "test-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should show script job details", async () => {
      const mockJob = createMockJob({
        id: "backup-job",
        name: "Backup Job",
        jobType: "script",
        cron: "0 0 * * *",
        script: "tar -czf backup.tar.gz /data",
        lastOutput: "Backup completed successfully",
      });

      mockGetJob.mockResolvedValue(mockJob);

      await runCommand(["cron", "show", "backup-job"]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // cron add <name> Tests
  // ============================================================================

  describe("cron add --name <name>", () => {
    it("should add a new cron job with cron expression", async () => {
      const mockJob = createMockJob({
        id: "daily-greeting",
        name: "Daily Greeting",
        cron: "0 9 * * *",
        agent: "main",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Daily Greeting",
        "--cron",
        "0 9 * * *",
        "--agent-id",
        "main",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Created cron job")
      );
    });

    it("should add a new cron job with --every interval", async () => {
      const mockJob = createMockJob({
        id: "hourly-check",
        name: "Hourly Check",
        every: 3600,
        agent: "monitor",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Hourly Check",
        "--every",
        "3600",
        "--agent-id",
        "monitor",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Created cron job")
      );
    });

    it("should add a cron job with --message", async () => {
      const mockJob = createMockJob({
        id: "daily-report",
        name: "Daily Report",
        cron: "0 17 * * 5",
        agent: "main",
        message: "Summarize this week's accomplishments",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Daily Report",
        "--cron",
        "0 17 * * 5",
        "--message",
        "Summarize this week's accomplishments",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should show error when neither --cron nor --every is provided", async () => {
      await runCommand(["cron", "add", "--name", "Test Job"]);

      expect(mockCreateJob).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Must specify either --cron or --every")
      );
    });

    it("should add a script job with --script option", async () => {
      const mockJob = createMockJob({
        id: "backup-job",
        name: "Backup Job",
        jobType: "script",
        cron: "0 0 * * *",
        script: "tar -czf backup.tar.gz /data",
        agent: "main",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Backup Job",
        "--cron",
        "0 0 * * *",
        "--script",
        "tar -czf backup.tar.gz /data",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should add a job with channel option", async () => {
      const mockJob = createMockJob({
        id: "telegram-job",
        name: "Telegram Notification",
        cron: "0 9 * * *",
        agent: "main",
        channel: "my-telegram",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Telegram Notification",
        "--cron",
        "0 9 * * *",
        "--channel",
        "my-telegram",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should output JSON when adding a job with --json flag", async () => {
      const mockJob = createMockJob({
        id: "json-job",
        name: "JSON Job",
        cron: "0 * * * *",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand(["--json", "cron", "add", "--name", "JSON Job", "--cron", "0 * * * *"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it("should use default agent-id when not specified", async () => {
      const mockJob = createMockJob({
        id: "default-agent-job",
        name: "Default Agent Job",
        cron: "0 * * * *",
        agent: "main",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Default Agent Job",
        "--cron",
        "0 * * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: "main",
        })
      );
    });

    it("should support short flag -n for --name", async () => {
      const mockJob = createMockJob({
        id: "short-flag-job",
        name: "Short Flag Job",
        cron: "0 * * * *",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "-n",
        "Short Flag Job",
        "--cron",
        "0 * * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Created cron job")
      );
    });
  });

  // ============================================================================
  // cron remove <id> Tests
  // ============================================================================

  describe("cron remove <id>", () => {
    it("should remove a cron job", async () => {
      const mockJob = createMockJob({
        id: "job-to-remove",
        name: "Job To Remove",
      });

      mockGetJob.mockResolvedValue(mockJob);
      mockDeleteJob.mockResolvedValue(undefined);

      await runCommand(["cron", "remove", "job-to-remove"]);

      expect(mockDeleteJob).toHaveBeenCalledWith("job-to-remove");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Removed cron job")
      );
    });

    it("should show error when job not found for removal", async () => {
      mockGetJob.mockResolvedValue(null);

      await runCommand(["cron", "remove", "nonexistent"]);

      expect(mockDeleteJob).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should output JSON when removing a job", async () => {
      const mockJob = createMockJob({
        id: "job-to-remove",
        name: "Job To Remove",
      });

      mockGetJob.mockResolvedValue(mockJob);
      mockDeleteJob.mockResolvedValue(undefined);

      await runCommand(["--json", "cron", "remove", "job-to-remove"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // cron enable <id> Tests
  // ============================================================================

  describe("cron enable <id>", () => {
    it("should enable a cron job", async () => {
      const mockJob = createMockJob({
        id: "disabled-job",
        name: "Disabled Job",
        enabled: true,
        nextRun: Date.now() + 3600000,
      });

      mockEnableJob.mockResolvedValue(mockJob);

      await runCommand(["cron", "enable", "disabled-job"]);

      expect(mockEnableJob).toHaveBeenCalledWith("disabled-job");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Enabled cron job")
      );
    });

    it("should show next run time after enabling", async () => {
      const nextRunTime = Date.now() + 3600000;
      const mockJob = createMockJob({
        id: "disabled-job",
        name: "Disabled Job",
        enabled: true,
        nextRun: nextRunTime,
      });

      mockEnableJob.mockResolvedValue(mockJob);

      await runCommand(["cron", "enable", "disabled-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Next Run")
      );
    });

    it("should output JSON when enabling a job", async () => {
      const mockJob = createMockJob({
        id: "disabled-job",
        name: "Disabled Job",
        enabled: true,
      });

      mockEnableJob.mockResolvedValue(mockJob);

      await runCommand(["--json", "cron", "enable", "disabled-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // cron disable <id> Tests
  // ============================================================================

  describe("cron disable <id>", () => {
    it("should disable a cron job", async () => {
      const mockJob = createMockJob({
        id: "enabled-job",
        name: "Enabled Job",
        enabled: false,
      });

      mockDisableJob.mockResolvedValue(mockJob);

      await runCommand(["cron", "disable", "enabled-job"]);

      expect(mockDisableJob).toHaveBeenCalledWith("enabled-job");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Disabled cron job")
      );
    });

    it("should output JSON when disabling a job", async () => {
      const mockJob = createMockJob({
        id: "enabled-job",
        name: "Enabled Job",
        enabled: false,
      });

      mockDisableJob.mockResolvedValue(mockJob);

      await runCommand(["--json", "cron", "disable", "enabled-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // cron run <id> Tests
  // ============================================================================

  describe("cron run <id>", () => {
    it("should run a cron job immediately", async () => {
      const mockJob = createMockJob({
        id: "run-job",
        name: "Run Job",
        lastStatus: "success" as JobStatus,
        lastOutput: "Job output",
      });

      // First call returns the job, second call returns updated status
      mockGetJob.mockResolvedValueOnce(mockJob).mockResolvedValueOnce({
        ...mockJob,
        lastStatus: "success" as JobStatus,
        lastOutput: "Job completed",
      });
      mockRunJob.mockResolvedValue(undefined);

      await runCommand(["cron", "run", "run-job"]);

      expect(mockRunJob).toHaveBeenCalledWith("run-job");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Running job")
      );
    });

    it("should show error when job not found for running", async () => {
      mockGetJob.mockResolvedValue(null);

      await runCommand(["cron", "run", "nonexistent"]);

      expect(mockRunJob).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("should show failure status when job fails", async () => {
      const mockJob = createMockJob({
        id: "failing-job",
        name: "Failing Job",
      });

      const failedJob = {
        ...mockJob,
        lastStatus: "failure" as JobStatus,
        lastError: "Script execution failed",
      };

      mockGetJob.mockResolvedValueOnce(mockJob).mockResolvedValueOnce(failedJob);
      mockRunJob.mockResolvedValue(undefined);

      await runCommand(["cron", "run", "failing-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Job failed")
      );
    });

    it("should show output when job succeeds with output", async () => {
      const mockJob = createMockJob({
        id: "output-job",
        name: "Output Job",
      });

      const completedJob = {
        ...mockJob,
        lastStatus: "success" as JobStatus,
        lastOutput: "This is the job output",
      };

      mockGetJob.mockResolvedValueOnce(mockJob).mockResolvedValueOnce(completedJob);
      mockRunJob.mockResolvedValue(undefined);

      await runCommand(["cron", "run", "output-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Output")
      );
    });

    it("should output JSON when running a job", async () => {
      const mockJob = createMockJob({
        id: "run-job",
        name: "Run Job",
        lastStatus: "success" as JobStatus,
      });

      mockGetJob.mockResolvedValueOnce(mockJob).mockResolvedValueOnce({
        ...mockJob,
        lastStatus: "success" as JobStatus,
      });
      mockRunJob.mockResolvedValue(undefined);

      await runCommand(["--json", "cron", "run", "run-job"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });
  });

  // ============================================================================
  // Cron Expression Format Tests
  // ============================================================================

  describe("cron expression support", () => {
    it("should accept standard cron expression format", async () => {
      // Standard cron: minute hour day-of-month month day-of-week
      const mockJob = createMockJob({
        id: "standard-cron",
        name: "Standard Cron",
        cron: "30 8 * * 1-5", // Weekdays at 8:30 AM
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Standard Cron",
        "--cron",
        "30 8 * * 1-5",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          cron: "30 8 * * 1-5",
        })
      );
    });

    it("should accept cron expression with step values", async () => {
      // Every 2 hours
      const mockJob = createMockJob({
        id: "step-cron",
        name: "Step Cron",
        cron: "0 */2 * * *",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Step Cron",
        "--cron",
        "0 */2 * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          cron: "0 */2 * * *",
        })
      );
    });

    it("should accept monthly cron expression", async () => {
      // First day of every month at midnight
      const mockJob = createMockJob({
        id: "monthly-cron",
        name: "Monthly Cron",
        cron: "0 0 1 * *",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Monthly Cron",
        "--cron",
        "0 0 1 * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          cron: "0 0 1 * *",
        })
      );
    });
  });

  // ============================================================================
  // Interval Support Tests
  // ============================================================================

  describe("interval support with --every", () => {
    it("should accept interval in seconds", async () => {
      const mockJob = createMockJob({
        id: "interval-job",
        name: "Interval Job",
        every: 300, // 5 minutes
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Interval Job",
        "--every",
        "300",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          every: 300,
        })
      );
    });

    it("should accept hourly interval", async () => {
      const mockJob = createMockJob({
        id: "hourly-job",
        name: "Hourly Job",
        every: 3600, // 1 hour
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Hourly Job",
        "--every",
        "3600",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          every: 3600,
        })
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should handle service errors gracefully for list", async () => {
      mockListJobs.mockRejectedValue(new Error("Service unavailable"));

      // Capture the error
      let errorThrown = false;
      try {
        await runCommand(["cron", "list"]);
      } catch {
        errorThrown = true;
      }

      // Error should be handled (either thrown or logged)
      expect(errorThrown || consoleErrorSpy.mock.calls.length > 0).toBe(true);
    });

    it("should handle enable job error for non-existent job", async () => {
      mockEnableJob.mockRejectedValue(new Error("Job not found: nonexistent"));

      let errorThrown = false;
      try {
        await runCommand(["cron", "enable", "nonexistent"]);
      } catch {
        errorThrown = true;
      }

      expect(errorThrown || consoleErrorSpy.mock.calls.length > 0).toBe(true);
    });

    it("should handle disable job error for non-existent job", async () => {
      mockDisableJob.mockRejectedValue(new Error("Job not found: nonexistent"));

      let errorThrown = false;
      try {
        await runCommand(["cron", "disable", "nonexistent"]);
      } catch {
        errorThrown = true;
      }

      expect(errorThrown || consoleErrorSpy.mock.calls.length > 0).toBe(true);
    });

    it("should handle duplicate job error", async () => {
      mockCreateJob.mockRejectedValue(new Error("Job already exists: existing-job"));

      let errorThrown = false;
      try {
        await runCommand([
          "cron",
          "add",
          "--name",
          "Existing Job",
          "--cron",
          "0 * * * *",
        ]);
      } catch {
        errorThrown = true;
      }

      expect(errorThrown || consoleErrorSpy.mock.calls.length > 0).toBe(true);
    });

    it("should handle delete error", async () => {
      mockGetJob.mockResolvedValue(createMockJob({ id: "delete-error-job" }));
      mockDeleteJob.mockRejectedValue(new Error("Failed to delete job"));

      let errorThrown = false;
      try {
        await runCommand(["cron", "remove", "delete-error-job"]);
      } catch {
        errorThrown = true;
      }

      expect(errorThrown || consoleErrorSpy.mock.calls.length > 0).toBe(true);
    });
  });

  // ============================================================================
  // Format Helper Tests
  // ============================================================================

  describe("format helpers", () => {
    it("should format schedule with cron expression in list", async () => {
      const mockJobs = [
        createMockJob({
          id: "cron-job",
          name: "Cron Job",
          cron: "0 9 * * *",
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      // Check that the cron expression appears in output
      const allLogs = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
      expect(allLogs).toContain("cron");
    });

    it("should format schedule with interval in seconds in list", async () => {
      const mockJobs = [
        createMockJob({
          id: "interval-job",
          name: "Interval Job",
          every: 30, // 30 seconds
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      const allLogs = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
      expect(allLogs).toContain("every");
    });

    it("should format schedule with interval in minutes in list", async () => {
      const mockJobs = [
        createMockJob({
          id: "minute-interval-job",
          name: "Minute Interval Job",
          every: 300, // 5 minutes
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      // Output should contain information about the interval
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should format schedule with interval in hours in list", async () => {
      const mockJobs = [
        createMockJob({
          id: "hour-interval-job",
          name: "Hour Interval Job",
          every: 7200, // 2 hours
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should format enabled status correctly in list", async () => {
      const mockJobs = [
        createMockJob({
          id: "enabled-job",
          name: "Enabled Job",
          enabled: true,
          cron: "0 * * * *",
        }),
        createMockJob({
          id: "disabled-job",
          name: "Disabled Job",
          enabled: false,
          cron: "0 * * * *",
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should format job status correctly in list", async () => {
      const mockJobs = [
        createMockJob({
          id: "success-job",
          name: "Success Job",
          cron: "0 * * * *",
          lastStatus: "success" as JobStatus,
        }),
        createMockJob({
          id: "failure-job",
          name: "Failure Job",
          cron: "0 * * * *",
          lastStatus: "failure" as JobStatus,
        }),
        createMockJob({
          id: "running-job",
          name: "Running Job",
          cron: "0 * * * *",
          lastStatus: "running" as JobStatus,
        }),
      ];

      mockListJobs.mockResolvedValue(mockJobs);

      await runCommand(["cron", "list"]);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Job Types Tests
  // ============================================================================

  describe("job types", () => {
    it("should create agent type job by default", async () => {
      const mockJob = createMockJob({
        id: "agent-job",
        name: "Agent Job",
        jobType: "agent",
        cron: "0 * * * *",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Agent Job",
        "--cron",
        "0 * * * *",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: "agent",
        })
      );
    });

    it("should create script type job when --script is provided", async () => {
      const mockJob = createMockJob({
        id: "script-job",
        name: "Script Job",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo hello",
      });

      mockCreateJob.mockResolvedValue(mockJob);

      await runCommand([
        "cron",
        "add",
        "--name",
        "Script Job",
        "--cron",
        "0 * * * *",
        "--script",
        "echo hello",
      ]);

      expect(mockCreateJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: "script",
          script: "echo hello",
        })
      );
    });
  });
});
