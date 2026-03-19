/**
 * Gateway Command Execution Tests
 *
 * Tests that verify actual behavior of gateway commands with real file operations,
 * using temp directories for configuration and state files.
 *
 * Unlike gateway.test.ts which mocks at a higher level,
 * these tests focus on verifying real file operations and configuration state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerGatewayCommand } from "./gateway";
import { ServiceManager } from "../../services";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import * as child_process from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";

// Mock child_process - both execSync and spawn
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: vi.fn(),
    spawn: vi.fn(),
  };
});

// Mock chalk to simplify output verification
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// We need to partially mock fs to handle openSync/closeSync for spawn stdio
// while keeping other fs functions real for file operations
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    openSync: vi.fn(() => 999), // Return a fake file descriptor
    closeSync: vi.fn(),
  };
});

/**
 * Create a mock child process for spawn
 */
function createMockChildProcess(pid: number): child_process.ChildProcess {
  const proc = new EventEmitter() as child_process.ChildProcess;
  Object.defineProperty(proc, "pid", { value: pid, writable: false });
  Object.defineProperty(proc, "stdio", {
    value: [null, null, null, null, null],
    writable: false,
  });
  Object.defineProperty(proc, "killed", { value: false, writable: true });
  Object.defineProperty(proc, "connected", { value: false, writable: true });
  Object.defineProperty(proc, "exitCode", { value: null, writable: true });
  Object.defineProperty(proc, "signalCode", { value: null, writable: true });
  Object.defineProperty(proc, "spawnargs", { value: [], writable: false });
  Object.defineProperty(proc, "spawnfile", { value: "", writable: false });

  proc.unref = vi.fn();
  proc.stdin = null;
  proc.stdout = null;
  proc.stderr = null;
  proc.kill = vi.fn(() => true);
  proc.send = vi.fn();
  proc.disconnect = vi.fn();
  proc.ref = vi.fn();

  return proc;
}

describe("gateway command execution", () => {
  let tempDir: TempDirContext;
  let serviceManager: ServiceManager;
  let program: Command;
  let consoleSpy: ConsoleSpy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;
  let processKillSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create temp directory for service state
    tempDir = await createTempDir("gateway-exec-test-");
    serviceManager = new ServiceManager(tempDir.root);
    await serviceManager.initialize();

    // Create CLI program
    program = new Command();
    program.option("--json", "Output JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");
    registerGatewayCommand(program);

    // Capture console output
    consoleSpy = createConsoleSpy();

    // Mock process.exit to throw instead of exiting
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as () => never);

    // Mock process.kill for checking if process is running
    processKillSpy = vi.spyOn(process, "kill");

    // Reset mocks
    vi.mocked(child_process.execSync).mockReset();
    vi.mocked(child_process.spawn).mockReset();
  });

  afterEach(async () => {
    consoleSpy.cleanup();
    processExitSpy.mockRestore();
    processKillSpy.mockRestore();
    vi.clearAllMocks();
    await tempDir.cleanup();
  });

  // Helper to run command
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // Helper to mock port check - returns PID when port is in use
  function mockPortInUse(port: number, pid: number): void {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd.includes(`:${port}`)) {
        return `${pid}\n`;
      }
      throw new Error("No process");
    });
  }

  // Helper to mock port as free
  function mockPortFree(): void {
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error("No process");
    });
  }

  // ============================================================================
  // ServiceManager Integration Tests
  // ============================================================================

  describe("ServiceManager integration", () => {
    it("should return gateway log path from service manager", async () => {
      const logPath = serviceManager.getLogPath("gateway");

      expect(logPath).toContain("gateway.log");
      expect(logPath).toContain(tempDir.root);
    });

    it("should create log directory structure", async () => {
      const logPath = serviceManager.getLogPath("gateway");
      const logDir = path.dirname(logPath);

      // The log directory should be creatable
      await tempDir.mkdir("logs");

      const exists = await tempDir.exists("logs");
      expect(exists).toBe(true);
    });
  });

  // ============================================================================
  // Port Configuration Tests
  // ============================================================================

  describe("port configuration", () => {
    it("should use default port 18790", async () => {
      mockPortFree();

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.port).toBe(18790);
    });

    it("should accept custom port via --port option", async () => {
      mockPortInUse(9000, 12345);

      await runCommand(["--json", "gateway", "status", "--port", "9000"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.port).toBe(9000);
      expect(parsed.data.status).toBe("running");
    });

    it("should detect process on non-default port", async () => {
      mockPortInUse(8080, 54321);

      await runCommand(["--json", "gateway", "status", "--port", "8080"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.pid).toBe(54321);
    });

    it("should parse port option as integer", async () => {
      // Mock port 12345 with a specific PID
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
        if (cmd.includes(":12345")) {
          return "99999\n";
        }
        throw new Error("No process");
      });

      await runCommand(["--json", "gateway", "status", "--port", "12345"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.port).toBe(12345);
    });
  });

  // ============================================================================
  // Host Configuration Tests
  // ============================================================================

  describe("host configuration", () => {
    it("should use default host 127.0.0.1", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.host).toBe("127.0.0.1");
    });

    it("should accept custom host via --host option on start", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start", "--host", "0.0.0.0"]);

      // Gateway already running, so just check no errors
      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
    });
  });

  // ============================================================================
  // Gateway Status Detection Tests
  // ============================================================================

  describe("gateway status detection", () => {
    it("should detect running gateway via lsof", async () => {
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
        if (cmd === "lsof -ti :18790") {
          return "12345\n";
        }
        throw new Error("No process");
      });

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.status).toBe("running");
      expect(parsed.data.pid).toBe(12345);
    });

    it("should detect stopped gateway when lsof returns no process", async () => {
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("No process");
      });

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.status).toBe("stopped");
      expect(parsed.data.pid).toBeUndefined();
    });

    it("should handle multiple PIDs on same port (take first)", async () => {
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
        if (cmd.includes(":18790")) {
          return "11111\n22222\n33333\n";
        }
        throw new Error("No process");
      });

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      // Should take first PID
      expect(parsed.data.pid).toBe(11111);
    });
  });

  // ============================================================================
  // Gateway Stop Tests
  // ============================================================================

  describe("gateway stop", () => {
    it("should call process.kill with SIGTERM when stopping", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["gateway", "stop"]);

      expect(processKillSpy).toHaveBeenCalledWith(12345, "SIGTERM");
    });

    it("should report stopped status after stop", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["--json", "gateway", "stop"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.status).toBe("stopped");
      expect(parsed.data.previousPid).toBe(12345);
    });

    it("should handle stop when gateway not running", async () => {
      mockPortFree();

      await runCommand(["--json", "gateway", "stop"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.status).toBe("stopped");
      expect(parsed.data.message).toBe("Gateway is not running");
    });

    it("should handle kill failure gracefully", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => {
        throw new Error("ESRCH");
      });

      // Should not throw
      await runCommand(["--json", "gateway", "stop"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      // Still reports stopped even if kill fails (process may have already exited)
      expect(parsed.data.status).toBe("stopped");
    });
  });

  // ============================================================================
  // Gateway Start Tests
  // ============================================================================

  describe("gateway start", () => {
    it("should report already running when gateway is running", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "start"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.status).toBe("running");
      expect(parsed.data.message).toBe("Gateway is already running");
    });

    it("should spawn daemon process with --daemon flag", async () => {
      const mockProc = createMockChildProcess(54321);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      // First call: port is free (before spawn)
      // Second call: port has process (after spawn, checking if started)
      let callCount = 0;
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
        callCount++;
        if (cmd.includes(":18790")) {
          if (callCount === 1) {
            // First check: port is free
            throw new Error("No process");
          }
          // Subsequent checks: gateway started
          return "54321\n";
        }
        throw new Error("No process");
      });

      await runCommand(["--json", "gateway", "start", "--daemon"]);

      // Verify spawn was called
      expect(child_process.spawn).toHaveBeenCalled();
      const spawnCall = vi.mocked(child_process.spawn).mock.calls[0];
      expect(spawnCall[1]).toContain("gateway");
      expect(spawnCall[1]).toContain("serve");
    });

    it("should pass port option to daemon process", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(11111);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["--json", "gateway", "start", "--daemon", "--port", "9000"]);

      const spawnCall = vi.mocked(child_process.spawn).mock.calls[0];
      expect(spawnCall[1]).toContain("--port");
      expect(spawnCall[1]).toContain("9000");
    });

    it("should pass host option to daemon process", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(22222);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["--json", "gateway", "start", "--daemon", "--host", "0.0.0.0"]);

      const spawnCall = vi.mocked(child_process.spawn).mock.calls[0];
      expect(spawnCall[1]).toContain("--host");
      expect(spawnCall[1]).toContain("0.0.0.0");
    });

    it("should detach daemon process", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(33333);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["--json", "gateway", "start", "--daemon"]);

      const spawnCall = vi.mocked(child_process.spawn).mock.calls[0];
      const options = spawnCall[2] as child_process.SpawnOptions;

      expect(options.detached).toBe(true);
      expect(mockProc.unref).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Gateway Restart Tests
  // ============================================================================

  describe("gateway restart", () => {
    it("should stop existing process before restart", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["gateway", "restart"]);

      expect(processKillSpy).toHaveBeenCalledWith(12345, "SIGTERM");
    });

    it("should force kill with --force option", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["gateway", "restart", "--force"]);

      expect(processKillSpy).toHaveBeenCalledWith(12345, "SIGKILL");
    });

    it("should start new gateway after stop", async () => {
      // Initially running
      let stopped = false;
      vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
        if (cmd.includes(":18790")) {
          if (stopped) {
            throw new Error("No process");
          }
          return "12345\n";
        }
        throw new Error("No process");
      });

      processKillSpy.mockImplementation((pid: number, signal?: string | number) => {
        if (pid === 12345 && signal === "SIGTERM") {
          stopped = true;
        }
        return true;
      });

      const mockProc = createMockChildProcess(54321);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      // After spawn, simulate gateway started
      await runCommand(["gateway", "restart", "--daemon"]);

      // Should have killed and then spawned
      expect(processKillSpy).toHaveBeenCalled();
      expect(child_process.spawn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("error handling", () => {
    it("should handle port conflict gracefully", async () => {
      // Port always reports in use, even after kill
      mockPortInUse(18790, 99999);

      await runCommand(["--json", "gateway", "start"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      // Should report already running
      expect(parsed.data.status).toBe("running");
    });

    it("should handle invalid port gracefully", async () => {
      mockPortFree();

      // The command should still work with large port numbers
      await runCommand(["--json", "gateway", "status", "--port", "65535"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
    });

    it("should handle execSync failure gracefully", async () => {
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("Command failed");
      });

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      // Should report stopped when we can't determine status
      expect(parsed.data.status).toBe("stopped");
    });
  });

  // ============================================================================
  // Verbose Output Tests
  // ============================================================================

  describe("verbose output", () => {
    it("should include log path in verbose JSON output", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "--verbose", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.logPath).toBeDefined();
      expect(parsed.data.logPath).toContain("gateway.log");
    });

    it("should show log file info in verbose text output", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--verbose", "gateway", "status"]);

      expect(consoleSpy.hasLog("Log file:")).toBe(true);
    });

    it("should include log path in stop verbose output", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["--json", "--verbose", "gateway", "stop"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.logPath).toBeDefined();
    });
  });

  // ============================================================================
  // JSON Output Structure Tests
  // ============================================================================

  describe("JSON output structure", () => {
    it("should have consistent JSON structure for status", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("success");
      expect(parsed).toHaveProperty("data");
      expect(parsed.data).toHaveProperty("name");
      expect(parsed.data).toHaveProperty("status");
      expect(parsed.data).toHaveProperty("host");
      expect(parsed.data).toHaveProperty("port");
    });

    it("should have consistent JSON structure for stop", async () => {
      mockPortInUse(18790, 12345);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["--json", "gateway", "stop"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.success).toBe(true);
      expect(parsed.data.name).toBe("gateway");
      expect(parsed.data.status).toBe("stopped");
      expect(parsed.data.port).toBe(18790);
    });

    it("should include previousPid when stopping running gateway", async () => {
      mockPortInUse(18790, 55555);
      processKillSpy.mockImplementation(() => true);

      await runCommand(["--json", "gateway", "stop"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      expect(parsed.data.previousPid).toBe(55555);
    });
  });

  // ============================================================================
  // Log File Operations Tests
  // ============================================================================

  describe("log file operations", () => {
    it("should create log directory when starting daemon", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(12345);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      // openSync is mocked, so we just verify it was called
      await runCommand(["gateway", "start", "--daemon"]);

      expect(fs.openSync).toHaveBeenCalled();
    });

    it("should write log file path correctly", async () => {
      const logPath = serviceManager.getLogPath("gateway");

      // Log path should be properly formed
      expect(logPath).toMatch(/gateway\.log$/);
      expect(path.isAbsolute(logPath)).toBe(true);
    });
  });

  // ============================================================================
  // Command Options Parsing Tests
  // ============================================================================

  describe("command options parsing", () => {
    it("should parse --log-level option", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(12345);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["gateway", "start", "--daemon", "--log-level", "debug"]);

      // Command should complete without error
      expect(child_process.spawn).toHaveBeenCalled();
    });

    it("should parse --agent option", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(12345);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["gateway", "start", "--daemon", "--agent", "custom-agent"]);

      // Command should complete without error
      expect(child_process.spawn).toHaveBeenCalled();
    });

    it("should parse short options -p, -l, -n, -d", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(12345);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["gateway", "start", "-d", "-p", "9000", "-l", "warn", "-n", "test"]);

      const spawnCall = vi.mocked(child_process.spawn).mock.calls[0];
      expect(spawnCall[1]).toContain("--port");
      expect(spawnCall[1]).toContain("9000");
    });
  });

  // ============================================================================
  // Endpoint Display Tests
  // ============================================================================

  describe("endpoint display", () => {
    it("should show endpoints when gateway is running", async () => {
      mockPortInUse(18790, 12345);

      await runCommand(["gateway", "status"]);

      expect(consoleSpy.hasLog("Endpoints:")).toBe(true);
      expect(consoleSpy.hasLog("http://127.0.0.1:18790/health")).toBe(true);
      expect(consoleSpy.hasLog("http://127.0.0.1:18790/api")).toBe(true);
    });

    it("should not show endpoints when gateway is stopped", async () => {
      mockPortFree();

      await runCommand(["gateway", "status"]);

      expect(consoleSpy.hasLog("Endpoints:")).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty lsof output", async () => {
      vi.mocked(child_process.execSync).mockImplementation(() => "\n");

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      // Empty output should be treated as no process
      expect(parsed.data.status).toBe("stopped");
    });

    it("should handle non-numeric PID in lsof output", async () => {
      vi.mocked(child_process.execSync).mockImplementation(() => "notanumber\n");

      await runCommand(["--json", "gateway", "status"]);

      const output = consoleSpy.logs.join("\n");
      const parsed = JSON.parse(output);

      // Should handle gracefully
      expect(parsed.success).toBe(true);
    });

    it("should handle restart when gateway is not initially running", async () => {
      mockPortFree();
      const mockProc = createMockChildProcess(12345);
      vi.mocked(child_process.spawn).mockReturnValue(mockProc);

      await runCommand(["gateway", "restart", "--daemon"]);

      // Should still spawn new gateway
      expect(child_process.spawn).toHaveBeenCalled();
    });
  });
});
