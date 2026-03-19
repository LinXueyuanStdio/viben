/**
 * Cron Command Execution Tests
 *
 * Tests that actually execute cron commands and verify real YAML file operations.
 * Uses real file system operations with temporary directories.
 *
 * This complements cron.test.ts which tests command registration with mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerCronCommand } from "./cron";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Test Setup
// =============================================================================

// Store the test config path globally for the mock
let _testConfigPath = "";

// Mock the crud module to override getDefaultConfigPath at source level
vi.mock("../../cron/ops/crud", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../cron/ops/crud")>();
  return {
    ...original,
    getDefaultConfigPath: () => _testConfigPath,
    // Re-implement listJobs to use our overridden getDefaultConfigPath
    listJobs: async (configPath?: string) => {
      const path = configPath || _testConfigPath;
      return original.listJobs(path);
    },
  };
});

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
    white: (s: string) => s,
    magenta: (s: string) => s,
  },
}));

// Store original process.exit and mock it
const originalExit = process.exit;
let exitCode: number | undefined;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext;
  program: Command;
  console: ConsoleSpy;
  configPath: string;
  /** Write config file */
  writeConfig: (content: string) => Promise<void>;
  /** Write YAML config object */
  writeYamlConfig: (jobs: Array<Record<string, unknown>>) => Promise<void>;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("cron-test-");
  const configPath = tempDir.resolve("cron.yaml");

  // Set the test config path for the mock
  _testConfigPath = configPath;

  // Mock process.exit to capture exit code instead of actually exiting
  exitCode = undefined;
  process.exit = vi.fn((code?: string | number | null | undefined) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerCronCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,
    configPath,

    async writeConfig(content: string) {
      await tempDir.writeFile("cron.yaml", content);
    },

    async writeYamlConfig(jobs: Array<Record<string, unknown>>) {
      const yaml = `version: 1\njobs:\n${jobs
        .map((job) => {
          const lines = Object.entries(job)
            .map(([key, value]) => {
              if (typeof value === "string") {
                return `    ${key}: "${value}"`;
              }
              return `    ${key}: ${value}`;
            })
            .join("\n");
          return `  -\n${lines}`;
        })
        .join("\n")}`;
      await tempDir.writeFile("cron.yaml", yaml);
    },

    async run(args: string[]) {
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        // Commander throws on exitOverride, but we can ignore it
        // Also ignore process.exit mock errors
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
    },

    async runJson(args: string[]) {
      try {
        await program.parseAsync(["node", "test", "--json", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
      const lastLog = consoleSpy.getLastLog();
      if (lastLog) {
        try {
          return JSON.parse(lastLog);
        } catch {
          return null;
        }
      }
      return null;
    },

    async cleanup() {
      consoleSpy.cleanup();
      await tempDir.cleanup();
      vi.clearAllMocks();
      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("cron command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // cron list execution
  // ===========================================================================

  describe("cron list", () => {
    it("should show message when no cron jobs exist", async () => {
      // Empty config
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "list"]);

      expect(ctx.console.hasLog("No cron jobs configured")).toBe(true);
    });

    it("should list cron jobs from config file", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: daily-greeting
    name: Daily Greeting
    enabled: true
    job_type: agent
    agent: main
    cron: "0 9 * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "list"]);

      expect(ctx.console.hasLog("daily-greeting")).toBe(true);
      expect(ctx.console.hasLog("Daily Greeting")).toBe(true);
    });

    it("should return JSON output with jobs list", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: test-job
    name: Test Job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      const result = (await ctx.runJson(["cron", "list"])) as {
        success: boolean;
        data: { jobs: Array<{ id: string; name: string }>; count: number };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.jobs).toBeDefined();
      expect(Array.isArray(result?.data?.jobs)).toBe(true);
      expect(result?.data?.jobs?.length).toBe(1);
      expect(result?.data?.jobs?.[0]?.id).toBe("test-job");
    });

    it("should create empty config if file does not exist", async () => {
      // No config file exists
      await ctx.run(["cron", "list"]);

      expect(ctx.console.hasLog("No cron jobs configured")).toBe(true);
    });
  });

  // ===========================================================================
  // cron show execution
  // ===========================================================================

  describe("cron show", () => {
    it("should show job details", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: my-job
    name: My Job
    description: A test job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 9 * * *"
    message: Hello World
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "show", "my-job"]);

      expect(ctx.console.hasLog("my-job")).toBe(true);
      expect(ctx.console.hasLog("My Job")).toBe(true);
    });

    it("should show error when job not found", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "show", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON with job details", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: json-job
    name: JSON Job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      const result = (await ctx.runJson(["cron", "show", "json-job"])) as {
        success: boolean;
        data: { id: string; name: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.id).toBe("json-job");
      expect(result?.data?.name).toBe("JSON Job");
    });
  });

  // ===========================================================================
  // cron add execution
  // ===========================================================================

  describe("cron add", () => {
    it("should create a new cron job with cron expression", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Daily Greeting",
        "--cron",
        "0 9 * * *",
        "--agent-id",
        "main",
      ]);

      expect(ctx.console.hasLog("Created cron job")).toBe(true);

      // Verify config file was updated
      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Daily Greeting");
      expect(content).toContain("0 9 * * *");
    });

    it("should create a new cron job with --every interval", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Hourly Check",
        "--every",
        "3600",
        "--agent-id",
        "monitor",
      ]);

      expect(ctx.console.hasLog("Created cron job")).toBe(true);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Hourly Check");
      expect(content).toContain("every: 3600");
    });

    it("should create a job with message option", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Message Job",
        "--cron",
        "0 17 * * 5",
        "--message",
        "Summarize this week",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Summarize this week");
    });

    it("should show error when neither --cron nor --every is provided", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "add", "--name", "No Schedule Job"]);

      expect(ctx.console.hasError("Must specify either --cron or --every")).toBe(true);
    });

    it("should create a script job with --script option", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Backup Job",
        "--cron",
        "0 0 * * *",
        "--script",
        "tar -czf backup.tar.gz /data",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("job_type: script");
      expect(content).toContain("tar -czf backup.tar.gz /data");
    });

    it("should create a job with channel option", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Channel Job",
        "--cron",
        "0 9 * * *",
        "--channel",
        "my-telegram",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("channel: my-telegram");
    });

    it("should return JSON output when creating a job", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      const result = (await ctx.runJson([
        "cron",
        "add",
        "--name",
        "JSON Job",
        "--cron",
        "0 * * * *",
      ])) as {
        success: boolean;
        data: { name: string; cron: string };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.name).toBe("JSON Job");
      expect(result?.data?.cron).toBe("0 * * * *");
    });

    it("should use default agent-id when not specified", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Default Agent Job",
        "--cron",
        "0 * * * *",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("agent: main");
    });

    it("should support short flag -n for --name", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "add", "-n", "Short Flag Job", "--cron", "0 * * * *"]);

      expect(ctx.console.hasLog("Created cron job")).toBe(true);
      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Short Flag Job");
    });

    it("should create config file if it does not exist", async () => {
      // No config file exists
      const exists = await ctx.tempDir.exists("cron.yaml");
      expect(exists).toBe(false);

      await ctx.run([
        "cron",
        "add",
        "--name",
        "First Job",
        "--cron",
        "0 * * * *",
      ]);

      const fileExists = await ctx.tempDir.exists("cron.yaml");
      expect(fileExists).toBe(true);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("First Job");
    });
  });

  // ===========================================================================
  // cron remove execution
  // ===========================================================================

  describe("cron remove", () => {
    it("should remove a cron job", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: job-to-remove
    name: Job To Remove
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "remove", "job-to-remove"]);

      expect(ctx.console.hasLog("Removed cron job")).toBe(true);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).not.toContain("job-to-remove");
    });

    it("should show error when job not found for removal", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "remove", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON output when removing a job", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: remove-json-job
    name: Remove JSON Job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      const result = (await ctx.runJson(["cron", "remove", "remove-json-job"])) as {
        success: boolean;
      };

      expect(result?.success).toBe(true);
    });

    it("should keep other jobs when removing one", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: job-1
    name: Job 1
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
  - id: job-2
    name: Job 2
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "remove", "job-1"]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).not.toContain("job-1");
      expect(content).toContain("job-2");
    });
  });

  // ===========================================================================
  // cron enable execution
  // ===========================================================================

  describe("cron enable", () => {
    it("should enable a disabled cron job", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: disabled-job
    name: Disabled Job
    enabled: false
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "enable", "disabled-job"]);

      expect(ctx.console.hasLog("Enabled cron job")).toBe(true);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("enabled: true");
    });

    it("should show Gateway note after enabling", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: gateway-job
    name: Gateway Job
    enabled: false
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "enable", "gateway-job"]);

      expect(ctx.console.hasLog("Scheduling takes effect when Gateway is running")).toBe(true);
    });

    it("should return JSON output when enabling a job", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: enable-json-job
    name: Enable JSON Job
    enabled: false
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      const result = (await ctx.runJson(["cron", "enable", "enable-json-job"])) as {
        success: boolean;
        data: { enabled: boolean };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.enabled).toBe(true);
    });

    it("should show error when job not found for enabling", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "enable", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // cron disable execution
  // ===========================================================================

  describe("cron disable", () => {
    it("should disable an enabled cron job", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: enabled-job
    name: Enabled Job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "disable", "enabled-job"]);

      expect(ctx.console.hasLog("Disabled cron job")).toBe(true);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("enabled: false");
    });

    it("should return JSON output when disabling a job", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: disable-json-job
    name: Disable JSON Job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      const result = (await ctx.runJson(["cron", "disable", "disable-json-job"])) as {
        success: boolean;
        data: { enabled: boolean };
      };

      expect(result?.success).toBe(true);
      expect(result?.data?.enabled).toBe(false);
    });

    it("should show error when job not found for disabling", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "disable", "nonexistent"]);

      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // Cron Expression Validation
  // ===========================================================================

  describe("cron expression validation", () => {
    it("should accept standard cron expression format", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Standard Cron",
        "--cron",
        "30 8 * * 1-5",
      ]);

      expect(ctx.console.hasLog("Created cron job")).toBe(true);
      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("30 8 * * 1-5");
    });

    it("should accept cron expression with step values", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Step Cron",
        "--cron",
        "0 */2 * * *",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("0 */2 * * *");
    });

    it("should accept monthly cron expression", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Monthly Cron",
        "--cron",
        "0 0 1 * *",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("0 0 1 * *");
    });
  });

  // ===========================================================================
  // Interval Support
  // ===========================================================================

  describe("interval support with --every", () => {
    it("should accept interval in seconds", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Interval Job",
        "--every",
        "300",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("every: 300");
    });

    it("should accept hourly interval", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Hourly Job",
        "--every",
        "3600",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("every: 3600");
    });

    it("should accept daily interval", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Daily Job",
        "--every",
        "86400",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("every: 86400");
    });
  });

  // ===========================================================================
  // Job Types
  // ===========================================================================

  describe("job types", () => {
    it("should create agent type job by default", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Agent Job",
        "--cron",
        "0 * * * *",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("job_type: agent");
    });

    it("should create script type job when --script is provided", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Script Job",
        "--cron",
        "0 * * * *",
        "--script",
        "echo hello",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("job_type: script");
      expect(content).toContain("echo hello");
    });
  });

  // ===========================================================================
  // Round-trip Tests
  // ===========================================================================

  describe("round-trip operations", () => {
    it("should create then list a job", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      // Create job
      await ctx.run([
        "cron",
        "add",
        "--name",
        "Round Trip Job",
        "--cron",
        "0 9 * * *",
      ]);

      ctx.console.reset();

      // List jobs - need fresh program instance
      const program2 = new (await import("commander")).Command();
      program2.option("--json", "Output JSON format");
      program2.option("--verbose", "Verbose output");
      program2.option("--quiet", "Quiet mode");
      program2.exitOverride();
      registerCronCommand(program2);

      await program2.parseAsync(["node", "test", "cron", "list"]);

      expect(ctx.console.hasLog("Round Trip Job")).toBe(true);
    });

    it("should create then show a job", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      // Create job and get its ID from config
      await ctx.run([
        "cron",
        "add",
        "--name",
        "Show Round Trip",
        "--cron",
        "0 9 * * *",
      ]);

      // Read the config to get the job ID
      const content = await ctx.tempDir.readFile("cron.yaml");
      const match = content.match(/id:\s*([a-f0-9-]+)/);
      const jobId = match?.[1];
      expect(jobId).toBeDefined();

      ctx.console.reset();

      // Show job - need fresh program instance
      const program2 = new (await import("commander")).Command();
      program2.option("--json", "Output JSON format");
      program2.option("--verbose", "Verbose output");
      program2.option("--quiet", "Quiet mode");
      program2.exitOverride();
      registerCronCommand(program2);

      await program2.parseAsync(["node", "test", "cron", "show", jobId!]);

      expect(ctx.console.hasLog("Show Round Trip")).toBe(true);
    });

    it("should create then enable then disable a job", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      // Create job (enabled by default)
      await ctx.run([
        "cron",
        "add",
        "--name",
        "Toggle Job",
        "--cron",
        "0 9 * * *",
      ]);

      // Read the config to get the job ID
      let content = await ctx.tempDir.readFile("cron.yaml");
      const match = content.match(/id:\s*([a-f0-9-]+)/);
      const jobId = match?.[1];
      expect(jobId).toBeDefined();

      // Disable - need fresh program instance
      const program2 = new (await import("commander")).Command();
      program2.option("--json", "Output JSON format");
      program2.option("--verbose", "Verbose output");
      program2.option("--quiet", "Quiet mode");
      program2.exitOverride();
      registerCronCommand(program2);

      await program2.parseAsync(["node", "test", "cron", "disable", jobId!]);

      content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("enabled: false");

      // Enable - need fresh program instance
      const program3 = new (await import("commander")).Command();
      program3.option("--json", "Output JSON format");
      program3.option("--verbose", "Verbose output");
      program3.option("--quiet", "Quiet mode");
      program3.exitOverride();
      registerCronCommand(program3);

      await program3.parseAsync(["node", "test", "cron", "enable", jobId!]);

      content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("enabled: true");
    });

    it("should create then remove a job", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      // Create job
      await ctx.run([
        "cron",
        "add",
        "--name",
        "Remove Me",
        "--cron",
        "0 9 * * *",
      ]);

      // Read the config to get the job ID
      let content = await ctx.tempDir.readFile("cron.yaml");
      const match = content.match(/id:\s*([a-f0-9-]+)/);
      const jobId = match?.[1];
      expect(jobId).toBeDefined();

      // Verify job exists
      expect(content).toContain("Remove Me");

      // Remove job - need fresh program instance
      const program2 = new (await import("commander")).Command();
      program2.option("--json", "Output JSON format");
      program2.option("--verbose", "Verbose output");
      program2.option("--quiet", "Quiet mode");
      program2.exitOverride();
      registerCronCommand(program2);

      await program2.parseAsync(["node", "test", "cron", "remove", jobId!]);

      // Verify job removed
      content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).not.toContain("Remove Me");
    });
  });

  // ===========================================================================
  // Multiple Jobs
  // ===========================================================================

  describe("multiple jobs", () => {
    it("should handle multiple jobs in config", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: job-1
    name: Job One
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
  - id: job-2
    name: Job Two
    enabled: false
    job_type: script
    agent: main
    every: 3600
    script: echo test
    created_at: 1700000000000
    updated_at: 1700000000000
  - id: job-3
    name: Job Three
    enabled: true
    job_type: agent
    agent: monitor
    cron: "0 9 * * 1-5"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run(["cron", "list"]);

      expect(ctx.console.hasLog("job-1")).toBe(true);
      expect(ctx.console.hasLog("job-2")).toBe(true);
      expect(ctx.console.hasLog("job-3")).toBe(true);
    });

    it("should add job to existing list", async () => {
      await ctx.writeConfig(`version: 1
jobs:
  - id: existing-job
    name: Existing Job
    enabled: true
    job_type: agent
    agent: main
    cron: "0 * * * *"
    created_at: 1700000000000
    updated_at: 1700000000000
`);

      await ctx.run([
        "cron",
        "add",
        "--name",
        "New Job",
        "--cron",
        "0 9 * * *",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Existing Job");
      expect(content).toContain("New Job");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle empty jobs array", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run(["cron", "list"]);

      expect(ctx.console.hasLog("No cron jobs configured")).toBe(true);
    });

    it("should handle job with all optional fields", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Full Job",
        "--cron",
        "0 9 * * *",
        "--agent-id",
        "custom-agent",
        "--message",
        "Custom message",
        "--channel",
        "my-channel",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Full Job");
      expect(content).toContain("custom-agent");
      expect(content).toContain("Custom message");
      expect(content).toContain("my-channel");
    });

    it("should handle special characters in name", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Job with: special & characters!",
        "--cron",
        "0 * * * *",
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain("Job with: special & characters!");
    });

    it("should handle very long message", async () => {
      await ctx.writeConfig("version: 1\njobs: []");

      const longMessage = "A".repeat(500);

      await ctx.run([
        "cron",
        "add",
        "--name",
        "Long Message Job",
        "--cron",
        "0 * * * *",
        "--message",
        longMessage,
      ]);

      const content = await ctx.tempDir.readFile("cron.yaml");
      expect(content).toContain(longMessage);
    });
  });
});
